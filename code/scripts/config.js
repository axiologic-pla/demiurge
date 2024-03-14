import {getStoredDID, setMainDID} from "./services/BootingIdentityService.js";
import utils from "./utils.js";
import constants from "./constants.js";

const {getUserDetails, getUserInfo} = await import("./hooks/getUserDetails.js");
const openDSU = require("opendsu");
const didAPI = openDSU.loadAPI("w3cdid");
const notificationHandler = openDSU.loadAPI("error");
const scAPI = openDSU.loadApi("sc");
const typicalBusinessLogicHub = didAPI.getTypicalBusinessLogicHub();
const {setConfig, getConfig, addControllers, addHook, navigateToPageTag} = WebCardinal.preload;
const {define} = WebCardinal.components;

let userData;

const {DwController, DwUI, setupDefaultModel} = await import("./controllers/DwController.js");
const dwUIInstance = new DwUI();

function waitForSharedEnclave(callback) {

  scAPI.getSharedEnclave((err, sharedEnclave) => {
    if (err) {
      return setTimeout(() => {
        console.log("Waiting for shared enclave .....");
        waitForSharedEnclave(callback);
      }, 100);
    }

    callback(undefined, sharedEnclave);
  });
}

async function setupGlobalErrorHandlers() {

  notificationHandler.observeUserRelevantMessages(constants.NOTIFICATION_TYPES.WARN, (notification) => {
    dwUIInstance.showToast(notification.message, {type: "warning"});
  });

  notificationHandler.observeUserRelevantMessages(constants.NOTIFICATION_TYPES.INFO, (notification) => {
    dwUIInstance.showToast(notification.message, {type: "info"})
  });

  notificationHandler.observeUserRelevantMessages(constants.NOTIFICATION_TYPES.ERROR, (notification) => {
    let errMsg = "";
    if (notification.err && notification.err.message) {
      errMsg = notification.err.message;
    }
    let toastMsg = `${notification.message} ${errMsg}`
    dwUIInstance.showToast(toastMsg, {type: "danger"})
  });
}

async function onUserLoginMessage(message) {
  await utils.addLogMessage(message.userDID, constants.OPERATIONS.LOGIN, message.userGroup, message.userId || "-", message.messageId, "-", message.actionDate)
}

async function watchAndHandleExecution(fnc) {
  try {
    await fnc();
  } catch (err) {
    if (err.rootCause === "security") {
      await utils.setWalletStatus(constants.ACCOUNT_STATUS.WAITING_APPROVAL);
      return;
    }
    if (window.confirm("Looks that your application is not properly initialized or in an invalid state. Would you like to reset it?")) {
      try {
        const response = await fetch("/removeSSOSecret/DSU_Fabric", {
          method: "DELETE",
          cache: "no-cache"
        })
        if (response.ok) {
          const basePath = window.location.href.split("loader")[0];
          $$.forceRedirect(basePath + "loader/newWallet.html");
        } else {
          let er = new Error(`Reset request failed (${response.status})`);
          er.rootCause = `statusCode: ${response.status}`;
          throw er;
        }
      } catch (err) {
        $$.showErrorAlert(`Failed to reset the application. RootCause: ${err.message}`);
        $$.forceTabRefresh();
      }
    } else {
      $$.showErrorAlert(`Application is an undesired state! It is a good idea to close all browser windows and try again!`);
      $$.forceTabRefresh();
    }
  }
  return true;
}

async function initializeWebCardinalConfig() {
  let userName = "-"
  const config = getConfig();
  config.translations = false;
  config.logLevel = "none";

  await watchAndHandleExecution(async () => {
    userData = await getUserDetails();
  });
  return config;
}

let config = await initializeWebCardinalConfig();

async function isFirstAdmin() {
  const didDomain = await $$.promisify(scAPI.getDIDDomain)();
  try {
    await $$.promisify(didAPI.resolveDID)(`did:${constants.SSI_NAME_DID_TYPE}:${didDomain}:${constants.INITIAL_IDENTITY_PUBLIC_NAME}`);
  } catch (e) {
    return true;
  }

  return false;
}

function finishInit() {
  setConfig(config);
  addHook(constants.HOOKS.BEFORE_APP_LOADS, async () => {
    // load Custom Components
    await import("../components/dw-spinner/dw-spinner.js");
    await import("../components/dw-title/dw-title.js");
    await import("../components/dw-data-grid/dw-data-grid.js");
    await import("../components/dw-copy-paste-input/dw-copy-paste-input.js");

    typicalBusinessLogicHub.strongSubscribe(constants.MESSAGE_TYPES.USER_LOGIN, onUserLoginMessage);

    // load Demiurge base Controller
    await setupDefaultModel(userData);
    addControllers({DwController});
    await setupGlobalErrorHandlers();
  });

  addHook(constants.HOOKS.AFTER_APP_LOADS, async () => {
    await import("../components/did-generator/did-generator.js");
    const {getEnvironmentDataAsync} = await import("./hooks/getEnvironmentData.js");
    const envData = await getEnvironmentDataAsync() || {};
    const enableGovernance = envData.enableGovernance || false;

    let status = await utils.getWalletStatus();

    if (status === constants.ACCOUNT_STATUS.CREATED) {
      await watchAndHandleExecution(async () => {
        await getUserInfo();
      })
      let did;
      try {
        did = await getStoredDID();
      } catch (err) {
      }
      if (did) {
        await setMainDID(typicalBusinessLogicHub, did, notificationHandler);
      }
      window.WebCardinal.loader.hidden = true;
      let adminGroup;
      try {
        const sharedEnclave = await $$.promisify(waitForSharedEnclave)();
        adminGroup = await utils.getAdminGroup(sharedEnclave);
        debugger
        let groupName = utils.getGroupName(adminGroup);
        WebCardinal.wallet.groupName = groupName;
        const epiEnclaveRecord = await $$.promisify(sharedEnclave.readKey)(constants.EPI_SHARED_ENCLAVE);
        let enclaveKeySSI = epiEnclaveRecord.enclaveKeySSI;
        await utils.addLogMessage(did, constants.OPERATIONS.LOGIN, groupName, userData.userName);
        let response = await fetch(`${window.location.origin}/checkIfMigrationIsNeeded`);
        if(response.status !== 200){
            throw new Error(`Failed to check if migration is needed. Status: ${response.status}`);
        }
        let migrationNeeded = await response.text();
        if (migrationNeeded === "true") {
          notificationHandler.reportUserRelevantInfo(`System Alert: Migration of Access Control Mechanisms is Currently Underway. Your Patience is Appreciated.`);
          await fetch(`${window.location.origin}/doMigration`, {
            body: JSON.stringify({epiEnclaveKeySSI: enclaveKeySSI}),
            method: "PUT",
            headers: {"Content-Type": "application/json"}
          });

          const openDSU = require("opendsu");
          const apiKeySpace = openDSU.loadAPI("apiKey");
          const crypto = openDSU.loadAPI("crypto");
          const w3cdid = openDSU.loadAPI("w3cdid");
          const apiKeyClient = apiKeySpace.getAPIKeysClient();
          try{
            await apiKeyClient.becomeSysAdmin(crypto.generateRandom(32).toString("base64"));
          }catch (e) {
            // another user is already sysadmin
            // making every demiurge admin a sysadmin
            let groupDIDDocument = await $$.promisify(w3cdid.resolveDID)(adminGroup.did);
            const members = await $$.promisify(groupDIDDocument.getMembers)();
            console.log(members)
            for(let member in members){
              const memberObject = members[member];
              if(member !== did){
                await apiKeyClient.makeSysAdmin(utils.getUserIdFromUsername(memberObject.username), crypto.generateRandom(32).toString("base64"));
              }
            }
          }

          async function assignAccessToGroups(sharedEnclave) {
            await utils.associateGroupAccess(sharedEnclave, constants.WRITE_ACCESS_MODE);
            await utils.associateGroupAccess(sharedEnclave, constants.READ_ONLY_ACCESS_MODE);
          }

          await assignAccessToGroups(sharedEnclave);
        }
          notificationHandler.reportUserRelevantInfo(`Migration of Access Control Mechanisms successfully!`);
      } catch (e) {
        notificationHandler.reportDevRelevantInfo(`Failed to audit login action. Probably an infrastructure or network issue`, e);
        return alert(`Failed to audit login action. Probably an infrastructure or network issue. ${e.message}`);
      }
      dwUIInstance.enableMenu();
      navigateToPageTag("groups");
    } else {
      dwUIInstance.disableMenu();
      const firstAdmin = await isFirstAdmin();
      navigateToPageTag("booting-identity", {isFirstAdmin: firstAdmin});
    }
  });

}

if (userData) {
  //we finish the init only if proper user details retrieval was executed
  finishInit();
}
