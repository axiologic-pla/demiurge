import {getWalletStatus, setWalletStatus} from "./services/BootingIdentityService.js";
import utils from "./utils.js";
import constants from "./constants.js";

const {getUserDetails, getUserInfo} = await import("./hooks/getUserDetails.js");
const openDSU = require("opendsu");
const didAPI = openDSU.loadAPI("w3cdid");
const typicalBusinessLogicHub = didAPI.getTypicalBusinessLogicHub();
const {setConfig, getConfig, addControllers, addHook, navigateToPageTag} = WebCardinal.preload;
const {define} = WebCardinal.components;
let userData;

function setInitialTheme() {
  function applyDarkTheme() {
    const schemeElement = document.head.querySelector("[name=color-scheme]");
    schemeElement.setAttribute("content", `${schemeElement.getAttribute("content")} dark`);
    document.body.classList.add("sl-theme-dark");
  }

  const storedTheme = window.localStorage.getItem("dw-theme");
  if (storedTheme === "dark") {
    applyDarkTheme();
    return;
  }
  if (storedTheme === "light") {
    return;
  }

  if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
    applyDarkTheme();
  }
}

async function setupGlobalErrorHandlers() {
  const {DwUI} = await import("./controllers/DwController.js");
  const dwUIInstance = new DwUI();
  let errHandler = openDSU.loadAPI("error");

  errHandler.observeUserRelevantMessages(constants.NOTIFICATION_TYPES.WARN, (notification) => {
    dwUIInstance.showToast(notification.message, {type: "warning"});
  });

  errHandler.observeUserRelevantMessages(constants.NOTIFICATION_TYPES.INFO, (notification) => {
    dwUIInstance.showToast(notification.message, {type: "info"})
  });

  errHandler.observeUserRelevantMessages(constants.NOTIFICATION_TYPES.ERROR, (notification) => {
    let errMsg = "";
    if (notification.err && notification.err.message) {
      errMsg = notification.err.message;
    }
    let toastMsg = `${notification.message} ${errMsg}`
    dwUIInstance.showToast(toastMsg, {type: "danger"})
  });
}

async function onUserLoginMessage(message) {
  await utils.addLogMessage(message.userDID, constants.OPERATIONS.LOGIN, message.userGroup, message.userId || "-", message.messageId)
}

async function onUserRemovedMessage(message) {
  let notificationHandler = openDSU.loadAPI("error");
  notificationHandler.reportUserRelevantWarning("Your account was deleted. Please contact an admin to see the reason");

  typicalBusinessLogicHub.stop();
//audit logs should already be registered during process message
  try{
    await utils.removeSharedEnclaveFromEnv();
    await setWalletStatus(constants.ACCOUNT_STATUS.WAITING_APPROVAL);
    $$.navigateToPage("home");
  }catch(err){
    $$.navigateToPage("home");
  }
}

async function watchAndHandleExecution(fnc) {
  try {
    await fnc();
  } catch (err) {
    if (err.rootCause === "security") {
      await setWalletStatus(constants.ACCOUNT_STATUS.WAITING_APPROVAL);
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

function finishInit() {
  setConfig(config);
  addHook(constants.HOOKS.BEFORE_APP_LOADS, async () => {
    // load Custom Components
    await import("../components/dw-header/dw-header.js");
    await import("../components/dw-menu/dw-menu.js");
    await import("../components/dw-spinner/dw-spinner.js");
    await import("../components/dw-title/dw-title.js");
    await import("../components/dw-data-grid/dw-data-grid.js");
    await import("../components/dw-clipboard-input/dw-clipboard-input.js");

    typicalBusinessLogicHub.strongSubscribe(constants.MESSAGE_TYPES.USER_LOGIN, onUserLoginMessage);
    typicalBusinessLogicHub.strongSubscribe(constants.MESSAGE_TYPES.USER_REMOVED, onUserRemovedMessage);

    // load Demiurge base Controller
    const {DwController, setupDefaultModel} = await import("./controllers/DwController.js");
    await setupDefaultModel(userData);
    addControllers({DwController});

    await setupGlobalErrorHandlers();
    let status = await getWalletStatus();
    if (status === constants.ACCOUNT_STATUS.CREATED)
      await watchAndHandleExecution(async () => {
        await getUserInfo();
      })
  });

  addHook(constants.HOOKS.AFTER_APP_LOADS, async () => {
    await import("../components/did-generator/did-generator.js");
    const {getEnvironmentDataAsync} = await import("./hooks/getEnvironmentData.js");
    const envData = await getEnvironmentDataAsync() || {};
    const enableGovernance = envData.enableGovernance || false;

    document.querySelectorAll("webc-app-menu-item").forEach(item => {
      if (!item.querySelector("a")) {
        return;
      }

      const menuItemName = item.querySelector("a").innerHTML;
      item.setAttribute("icon-name", menuItemName);
      if (menuItemName === "My Identities") {
        let iconDiv = document.createElement("div");
        iconDiv.innerHTML = `<sl-icon name="person-fill" class="menu-item-icon"></sl-icon>`;
        item.parentElement.insertBefore(iconDiv, item);
      }

      if (menuItemName === "Groups") {
        let iconDiv = document.createElement("div");
        iconDiv.innerHTML = `<sl-icon name="people-fill" class="menu-item-icon"></sl-icon>`;
        item.parentElement.insertBefore(iconDiv, item);
      }

      if (menuItemName === "Governance") {
        if (!enableGovernance) {
          item.remove();
          return;
        }
        let iconDiv = document.createElement("div");
        iconDiv.innerHTML = `<sl-icon name="clouds-fill" class="menu-item-icon"></sl-icon>`;
        item.parentElement.insertBefore(iconDiv, item);
      }

      if (menuItemName === "Audit") {
        let iconDiv = document.createElement("div");
        iconDiv.innerHTML = `<sl-icon name="person-lines-fill" class="menu-item-icon"></sl-icon>`;
        item.parentElement.insertBefore(iconDiv, item);
      }
    });

    //go to home page and clear selected menu item
    try {
      document.querySelector(".logo-container").addEventListener("click", async () => {
        if (document.querySelector("webc-app-menu-item[active]")) {
          document.querySelector("webc-app-menu-item[active]").removeAttribute("active");
        }
        await navigateToPageTag("home", {skipLoginAudit: true});
      })
    } catch (e) {
      console.log("Menu not initialized yet.", e);
    }


  });

  define("dw-action");
  define("dw-subdomains");
  define("dw-dialog-configuration");
  define("dw-dialog-view-credential");
  define("dw-dialog-booting-identity");
  define("dw-dialog-add-domain");
  define("dw-dialog-waiting-approval");
  define("dw-dialog-initialising");
  define("dw-dialog-break-glass-recovery");
  define("dw-dialog-group-members-update");
}

if (userData) {
  //we finish the init only if proper user details retrieval was executed
  finishInit();
}
