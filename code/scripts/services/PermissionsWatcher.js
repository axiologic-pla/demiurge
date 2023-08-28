import constants from "./../constants.js";
import utils from "../utils.js";
import {getStoredDID, setStoredDID, setWalletStatus, setMainDID} from "../services/BootingIdentityService.js";

const openDSU = require("opendsu");
const w3cDID = openDSU.loadAPI("w3cdid");
const scAPI = openDSU.loadAPI("sc");
const defaultHandler = function(){console.log("User is authorized")};

class PermissionsWatcher {
  constructor(did, isAuthorizedHandler) {
    this.notificationHandler = openDSU.loadAPI("error");
    this.isAuthorizedHandler = isAuthorizedHandler || defaultHandler;
    if (did) {
      this.checkAccess().then(hasAccess=>{
        if(hasAccess){
          this.isAuthorizedHandler();
        }
      }).catch(err=>{
        //at this point this check if fails may not be that important....
      });

      this.setup(did);
    } else {
      console.log("Trying retrieve DID info...");
      scAPI.getMainEnclave(async (err, mainEnclave) => {
        if (err) {
          this.notificationHandler.reportUserRelevantError(`Failed to load the wallet`, err);
          this.notificationHandler.reportUserRelevantInfo(
            "Application will refresh soon to ensure proper state. If you see this message again, check network connectivity and if necessary get in contact with Admin.");
          return $$.forceTabRefresh();
        }
        let identity;
        try{
          identity = await $$.promisify(mainEnclave.readKey)(constants.IDENTITY);
        }catch(err){

        }
        did = identity.did;
        this.setup(did);
      });
    }
  }

  enableHttpInterceptor(){
    let http = require("opendsu").loadApi("http");
    let self = this;
    http.registerInterceptor((target, callback)=>{
      if( (self.delayMQ || $$.refreshInProgress ) && target.url.indexOf("/mq/") !== -1){
        //we delay all mq requests because we wait for the refresh to happen or message digestion...
        self.registerMQRequest({target, callback});
        return;
      }
      callback(undefined, target);
    });
  }

  registerMQRequest(target){
    if(!this.delayed){
      this.delayed = [];
    }
    console.debug("Delaying a mq request.");
    this.delayed.push(target);
  }

  delayMQRequests(){
    this.delayMQ = true;
  }

  resumeMQRequests(){
    this.delayMQ = false;
    if(this.delayed && this.delayed.length){
      while(this.delayed.length){
        let delayed = this.delayed.shift();
        console.debug("Resuming mq request.");
        delayed.callback(undefined, delayed.target);
      }
    }
  }

  setup(did){
    this.did = did;
    //setup of communication hub
    if(!window.commHub){
      this.typicalBusinessLogicHub = w3cDID.getTypicalBusinessLogicHub();
      window.commHub = this.typicalBusinessLogicHub;

      this.enableHttpInterceptor();

      $$.promisify(this.typicalBusinessLogicHub.setMainDID)(did).then(() => {
        this.setupListeners();
      }).catch(err => {
        console.log("Failed to setup typical business logic hub", err);
      });
    }

    //setup of credential check interval to prevent edge cases
    /*if(!window.credentialsCheckInterval){
      const interval = 30*1000;
      window.credentialsCheckInterval = setInterval(async()=>{
        console.debug("Permissions check ...");
        let userRights;
        let unAuthorizedPages = ["generate-did", "landing-page"];
        try{
          userRights = await this.getUserRights();
        }catch (err){
          //if we have errors user doesn't have any rights
          if(window.lastUserRights || unAuthorizedPages.indexOf(WebCardinal.state.page.tag)===1){
            //User had rights and lost them...
            if (err.rootCause === "security") {
              this.notificationHandler.reportUserRelevantError("Security error: ", err);
              this.notificationHandler.reportUserRelevantInfo("The application will refresh soon...");
              $$.forceTabRefresh();
              console.debug("Permissions check -");
            }
          }

          //there is no else that we need to take care of it...
        }
        //if no error user has rights, and we need just to check that nothing changed since last check
        if(userRights && window.lastUserRights && userRights !== window.lastUserRights){
          //this case is possible if the Admin fails to send the message with the credential due to network issue or something and this is why we should ask for a review of the authorization process.
          console.debug("Permissions check *");
          this.notificationHandler.reportUserRelevantInfo("Your credentials have changed. The application will refresh soon...");
          $$.forceTabRefresh();
          return;
        }

        //if user has rights but is on a page that doesn't need authorization
        // we could believe that app state didn't change properly by various causes...
        // let's try to refresh...
        if(userRights && unAuthorizedPages.indexOf(WebCardinal.state.page.tag) === 1){
          this.notificationHandler.reportUserRelevantInfo("A possible wrong app state was detected based on current state and credentials. The application will refresh soon...");
          $$.forceTabRefresh();
          return;
        }

      }, interval);
      console.log(`Permissions will be checked once every ${interval}ms`);
    }*/

  }

  setupListeners(){
    this.typicalBusinessLogicHub.subscribe(constants.MESSAGE_TYPES.ADD_MEMBER_TO_GROUP, async (...args)=>{
      this.delayMQRequests();
      await this.onUserAdded(...args);
      this.resumeMQRequests();
    });
    this.typicalBusinessLogicHub.strongSubscribe(constants.MESSAGE_TYPES.USER_REMOVED, async (...args)=>{
      this.delayMQRequests();
      await this.onUserRemoved(...args);
      this.resumeMQRequests();
    });

    this.typicalBusinessLogicHub.registerErrorHandler((issue)=>{
      let {err, message} = issue;
      if(typeof message === "undefined" && err){
        this.notificationHandler.reportUserRelevantError("Communication error: ", err);
        this.notificationHandler.reportUserRelevantInfo("Application will refresh to establish the communication");
        setTimeout($$.forceTabRefresh, 2000);
        return;
      }
      this.notificationHandler.reportUserRelevantError("Unknown error: ", err);
    });
  }

  async onUserRemoved(message) {
    let hasRights ;
    try{
      hasRights = await this.isInAdminGroup();
    }catch (err){
      //not sure if this should get to console or user...
      console.log(err);
      hasRights = false;
    }

    if(hasRights){
      console.log("Skipping this delete message because user still present in group");
      return;
    }

    let hasAccess = false;
    try{
      hasAccess = await this.checkAccess();
    }catch(err){
      hasAccess = false;
    }

    if(!hasAccess){
      console.log("Skipping this delete message because user is not authorized yet");
      return;
    }

    this.typicalBusinessLogicHub.stop();
    //audit logs should already be registered during process message

    try {
      await setWalletStatus(constants.ACCOUNT_STATUS.WAITING_APPROVAL);
      await this.resettingCredentials();
    } catch (err) {
      this.notificationHandler.reportUserRelevantError("Failed to properly handling credentials change");
    }

    this.notificationHandler.reportUserRelevantInfo("Your credentials was removed.");
    this.notificationHandler.reportUserRelevantInfo("Application will refresh soon...");
    $$.forceTabRefresh();
  }

  async getAdminGroup(sharedEnclave) {
    let groups = await $$.promisify(sharedEnclave.filter)(constants.TABLES.GROUPS);
    let adminGroup = groups.find((gr) => gr.accessMode === constants.ADMIN_ACCESS_MODE || gr.name === constants.EPI_ADMIN_GROUP_NAME) || {};
    if (!adminGroup) {
      throw new Error("Admin group not created yet.")
    }
    return adminGroup;
  }

  async isInAdminGroup(did) {
    const openDSU = require("opendsu");
    let resolveDID = $$.promisify(openDSU.loadApi("w3cdid").resolveDID);
    let didDocument = await resolveDID(this.did);
    let groupDID = `did:ssi:group:${didDocument.getDomain()}:${constants.EPI_ADMIN_GROUP}`

    let groupDIDDocument = await resolveDID(groupDID);
    await $$.promisify(groupDIDDocument.dsu.refresh)();
    let groupMembers = await $$.promisify(groupDIDDocument.listMembersByIdentity, groupDIDDocument)();
    for (let member of groupMembers) {
      if (member === this.did) {
        return true;
      }
    }
    return false;
  }

  async onUserAdded(message) {

    let hasAccess;
    try{
      hasAccess = await this.checkAccess();
      let isAdmin = await this.isInAdminGroup();
      if(!isAdmin){
        return console.log("Skipping message because user is not in group.");
      }
    }catch(err){
      hasAccess = false;
    }

    if(hasAccess){
      console.log("Already has access, skipping the message");
      return;
    }

    try{
      await utils.addSharedEnclaveToEnv(message.enclave.enclaveType, message.enclave.enclaveDID, message.enclave.enclaveKeySSI);
      this.notificationHandler.reportUserRelevantInfo("Credentials were save with success");
    }catch(err){
      this.notificationHandler.reportUserRelevantError(`Failed to save info about the shared enclave`, e);
      this.notificationHandler.reportUserRelevantError("Request reauthorization!");
      this.notificationHandler.reportUserRelevantInfo("Application will refresh soon...");
      return $$.forceTabRefresh();
    }

    try {
      await setWalletStatus(constants.ACCOUNT_STATUS.CREATED);
    }catch(err){
      this.notificationHandler.reportUserRelevantError("Failed to initialize wallet", err);
      this.notificationHandler.reportUserRelevantInfo(
        "Application will refresh to ensure proper state. If you see this message again check network connection and if necessary contact an admin.");
      return $$.forceTabRefresh();
    }

    this.isAuthorizedHandler();
  }

  async setSharedEnclaveFromMessage(enclave) {
    try {
      const mainDSU = await $$.promisify(scAPI.getMainDSU)();
      let env = await $$.promisify(mainDSU.readFile)("/environment.json");
      env = JSON.parse(env.toString());
      const openDSU = require("opendsu");
      env[openDSU.constants.SHARED_ENCLAVE.TYPE] = enclave.enclaveType;
      env[openDSU.constants.SHARED_ENCLAVE.DID] = enclave.enclaveDID;
      env[openDSU.constants.SHARED_ENCLAVE.KEY_SSI] = enclave.enclaveKeySSI;
      await $$.promisify(scAPI.configEnvironment)(env);
    } catch (e) {
      this.notificationHandler.reportUserRelevantError(`Failed to save info about the shared enclave`, e);
    }
  }

  async resettingCredentials() {
    await utils.removeSharedEnclaveFromEnv();
  }

  async checkAccess() {
    let sharedEnclave;
    try {
      sharedEnclave = await $$.promisify(scAPI.getSharedEnclave)();
    } catch (err) {
      // TODO check error type to differentiate between business and technical error
      this.notificationHandler.reportDevRelevantInfo("User is waiting for access to be granted")
    }

    if (sharedEnclave) {
      return true;
    }
    return false;
  }
}

export function getPermissionsWatcher(did, isAuthorizedHandler) {
  return new PermissionsWatcher(did, isAuthorizedHandler);
};