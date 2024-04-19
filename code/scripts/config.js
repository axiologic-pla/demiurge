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
        let groupName = utils.getGroupName(adminGroup);
        WebCardinal.wallet.groupName = groupName;
        await utils.addLogMessage(did, constants.OPERATIONS.LOGIN, groupName, userData.userName);
        await utils.doMigration(sharedEnclave);
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
