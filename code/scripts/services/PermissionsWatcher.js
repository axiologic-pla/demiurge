import constants from "./../constants.js";
import utils from "../utils.js";

const openDSU = require("opendsu");
const scAPI = openDSU.loadAPI("sc");
const defaultHandler = function(){console.log("User is authorized")};

class PermissionsWatcher {
  constructor(did, isAuthorizedHandler) {
    this.notificationHandler = openDSU.loadAPI("error");
    this.isAuthorizedHandler = isAuthorizedHandler || defaultHandler;
    utils.showTextLoader();
    this.checkAccessAndAct().then(()=>{
      utils.hideTextLoader();
    }).catch(err=>{
      console.debug('Caught an error during booting of the PermissionsWatcher...', err);
    });

    this.setupIntervalCheck();
  }

  setupIntervalCheck(){
    //setup of credential check interval to prevent edge cases
    if(!window.credentialsCheckInterval){
      const interval = 10*1000;
      window.credentialsCheckInterval = setInterval(async()=>{
        await this.checkAccessAndAct();
      }, interval);
      console.log(`Permissions will be checked once every ${interval}ms`);
    }
  }

  async checkAccessAndAct(){
    this.checkAccess().then( async (hasAccess)=>{
      let unAuthorizedPages = ["booting-identity", "landing-page"];
      if(hasAccess){
        if(unAuthorizedPages.indexOf(WebCardinal.state.page.tag) !== -1) {
          //if we are on a booting page then we need to redirect...
          this.isAuthorizedHandler();
        }
      }else{
        if(unAuthorizedPages.indexOf(WebCardinal.state.page.tag) !== -1) {
          //if we are on a booting page then we do nothing..,
          return;
        }

        //we try to reset no matter if we had or no any credentials...
        await this.resettingCredentials();

        this.notificationHandler.reportUserRelevantInfo("Your credentials was removed.");
        this.notificationHandler.reportUserRelevantInfo("Application will refresh soon...");
        $$.forceTabRefresh();
        return;
      }
    }).catch(async err=>{
      //at this point this check if fails may not be that important....
    });
  }

  async saveCredentials(credentials) {
    let enclave = credentials.enclave;
    if(window.lastCredentials && enclave.enclaveKeySSI === window.lastCredentials.enclaveKeySSI){
      // there is no need to trigger the credentials save...
      return ;
    }
    window.lastCredentials = enclave;
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
    await utils.setWalletStatus(constants.ACCOUNT_STATUS);
    await $$.promisify(scAPI.deleteSharedEnclave)();
  }

  async checkAccess() {
    if(!this.did){
      try{
        this.did = await scAPI.getMainDIDAsync();
      }catch(err){
        this.notificationHandler.reportUserRelevantError(`Failed to load the wallet`, err);
        this.notificationHandler.reportUserRelevantInfo(
          "Application will refresh soon to ensure proper state. If you see this message again, check network connectivity and if necessary get in contact with Admin.");
        return $$.forceTabRefresh();
      }
    }

    if(!this.handler){
      try{
        let SecretsHandler = require("opendsu").loadApi("w3cdid").SecretsHandler;
        this.handler = await SecretsHandler.getInstance(this.did);
      }catch(err){
        this.notificationHandler.reportUserRelevantError(`Failed to load the wallet`, err);
        this.notificationHandler.reportUserRelevantInfo(
          "Application will refresh soon to ensure proper state. If you see this message again, check network connectivity and if necessary get in contact with Admin.");
        return $$.forceTabRefresh();
      }
    }

    try{
      let creds = await this.handler.checkIfUserIsAuthorized(this.did);
      if(creds){
        await this.saveCredentials(creds);
        return true;
      }
    }catch(err){
      let knownStatusCodes = [404, 500];
      if(knownStatusCodes.indexOf(err.code) === -1){
        throw err;
      }
      console.debug("Caught an error during checking access", err);
    }
    return false;
  }
}

export function getPermissionsWatcher(did, isAuthorizedHandler) {
  return new PermissionsWatcher(did, isAuthorizedHandler);
};
