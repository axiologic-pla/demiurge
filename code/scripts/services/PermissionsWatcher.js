import constants from "./../constants.js";
import utils from "../utils.js";
import {getGroupCredential} from "../mappings/utils.js";

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
    }).catch(async ()=>{
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

      await utils.setWalletStatus(constants.ACCOUNT_STATUS.CREATED);

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
      let knownStatusCodes = [404];
      if(knownStatusCodes.indexOf(err.code) === -1){
        throw err;
      }
      console.debug("Caught an error during checking access", err);
    }
    // let migrationDone = await this.testAndMigrateFromMQs();
    // if(!migrationDone){
    //   return false;
    // }
  }

  async migrateGroup (groupDID, enclaveData, includeAllPossible){
    const w3cdid = require("opendsu").loadApi("w3cdid");
    let domain = await $$.promisify(scAPI.getVaultDomain)();
    let didDocument;
    try{
      didDocument = await $$.promisify(w3cdid.resolveDID)(groupDID);
    }catch(err){
      this.notificationHandler.reportUserRelevantError(`Error: Failed to resolve ${groupDID}`, err);
    }
    if(!didDocument){
      this.notificationHandler.reportUserRelevantInfo(`Migration status: ${groupDID} not resolved. Skipping...`);
    }else{
      let groupCredential;
      try{
        groupCredential = await getGroupCredential(groupDID);
        if(includeAllPossible){
          let allPossibleGroups = [
            {"name":"ePI Write Group","tags":"DSU_Fabric","enclaveName":"epiEnclave","accessMode":"write","did":`did:ssi:group:${domain}:ePI_Write_Group`},
            {"name":"ePI Read Group","tags":"DSU_Fabric","enclaveName":"epiEnclave","accessMode":"read","did":`did:ssi:group:${domain}:ePI_Read_Group`}
          ];
          groupCredential.allPossibleGroups = allPossibleGroups;
        }
        let users = await $$.promisify(didDocument.listMembersByIdentity, didDocument)();
        for(let user of users){
          await this.handler.authorizeUser(user, groupCredential, enclaveData);
        }
        this.notificationHandler.reportUserRelevantInfo(`Migration status: ${groupDID} is resolved. Continuing...`);
      }catch(err){
        this.notificationHandler.reportUserRelevantError(`Error: Failed to authorize ${groupDID} users`, err);
        this.notificationHandler.reportUserRelevantInfo(`Migration status: ${groupDID} not resolved. Skipping...`);
      }
    }
  }

  async testAndMigrateFromMQs(){
    if(window.migrationInProgress){
      if(!this.pendingPromises){
        this.pendingPromises = [];
      }
      return new Promise((resolve)=>{
        this.pendingPromises.push(resolve);
      });
    }
    window.migrationInProgress = true;
    let migrationDone = false;
    let enclaveData = await utils.getSharedEnclaveDataFromEnv();
    const w3cdid = require("opendsu").loadApi("w3cdid");
    let migrationDID;
    try{
      migrationDID = await $$.promisify(w3cdid.getKeyDIDFromSecret)("Migration_2023.2.0");
    }catch(err){
      console.log(err);
    }
    if(enclaveData && enclaveData.enclaveKeySSI){
      //we have the data in env... so we need to test if migration need to be performed

      let domain = await $$.promisify(scAPI.getVaultDomain)();
      let groupName = constants.EPI_ADMIN_GROUP;
      let adminGroupDID = `did:ssi:group:${domain}:${groupName}`;

      try{
        await $$.promisify(w3cdid.resolveDID)(adminGroupDID);
      }catch(err){
        return;
      }
      try{
        migrationDone = await this.handler.getDIDSecret(migrationDID, "mqMigration");
      }catch(err){
        let knownStatus = [404];
        if(err.code && knownStatus.indexOf(err.code)!==-1){
          migrationDone = false;
        }
        //for any other errors is best to don't do the migration...
      }
      if(!migrationDone){

        this.notificationHandler.reportUserRelevantInfo(`System Alert: Migration of Access Control Mechanisms is Currently Underway. Your Patience is Appreciated.`);
        await this.migrateGroup(adminGroupDID, enclaveData);

        let writeGroup = constants.EPI_WRITE_GROUP;
        let writeGroupDID = `did:ssi:group:${domain}:${writeGroup}`;
        let sharedEnclave = await $$.promisify(scAPI.getSharedEnclave)();

        let groupEnclaveData = await $$.promisify(sharedEnclave.readKey)(constants.EPI_SHARED_ENCLAVE);

        await this.migrateGroup(writeGroupDID, groupEnclaveData, true);

        let readGroup = constants.EPI_READ_GROUP;
        let readGroupDID = `did:ssi:group:${domain}:${readGroup}`;
        await this.migrateGroup(readGroupDID, groupEnclaveData, true);

        await this.handler.storeDIDSecret(migrationDID, {enclave: enclaveData.enclaveKeySSI}, "mqMigration");
        this.notificationHandler.reportUserRelevantInfo(`Migration of Access Control Mechanisms successfully!`);
        migrationDone = true;
      }else{
        //we need to set migration to false in order to escape the loop from the check access method
        migrationDone = false;
      }
    }
    window.migrationInProgress = false;
    if(this.pendingPromises){
      for(let resolve of this.pendingPromises){
        resolve(migrationDone);
      }
    }
    return migrationDone;
  }
}

export function getPermissionsWatcher(did, isAuthorizedHandler) {
  return new PermissionsWatcher(did, isAuthorizedHandler);
}