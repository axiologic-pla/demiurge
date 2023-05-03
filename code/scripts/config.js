import {getStoredDID, didWasApproved, getWalletStatus, setWalletStatus} from "./services/BootingIdentityService.js";
import utils from "./utils.js";
import constants from "./constants.js";

const {getUserDetails} = await import("./hooks/getUserDetails.js");
const openDSU = require("opendsu");
const didAPI = openDSU.loadAPI("w3cdid");
const typicalBusinessLogicHub = didAPI.getTypicalBusinessLogicHub();
let userData;

try {
  userData = await getUserDetails();
} catch (err) {
  if (window.confirm("Looks that your application is not properly initialized or in an invalid state. Would you like to reset it?")) {
    try {
      const response = await fetch("/removeSSOSecret/Demiurge", {
        method: "DELETE",
        cache: "no-cache"
      })
      if (response.ok) {
        window.disableRefreshSafetyAlert = true;
        const basePath = window.location.href.split("loader")[0];
        window.location.replace(basePath + "loader/newWallet.html");
      } else {
        let er = new Error(`Reset request failed (${response.status})`);
        er.rootCause = `statusCode: ${response.status}`;
        throw er;
      }
    } catch (err) {
      alert(`Failed to reset the application. RootCause: ${err.message}`);
    }
  } else {
    alert(`Application is an undesired state! Contact support!`);
  }
}

if(userData){
  const {setConfig, getConfig, addControllers, addHook, navigateToPageTag} = WebCardinal.preload;
  const {define} = WebCardinal.components;
  let userName = "-"

  function getInitialConfig() {
    const config = getConfig();
    config.translations = false;
    config.logLevel = "none";
    return config;
  }

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

  function onUserLoginMessage(message) {
    utils.addLogMessage(message.userDID, constants.OPERATIONS.LOGIN, message.userGroup, message.userId || "-", message.messageId)
      .then(() => {
      })
      .catch(err => console.log(err));
  }

  function onUserRemovedMessage(message) {
    let notificationHandler = openDSU.loadAPI("error");
    notificationHandler.reportUserRelevantWarning("Your account was deleted. Please contact an admin to see the reason");

    typicalBusinessLogicHub.stop();
//audit logs should already be registered during process message
    utils.removeSharedEnclaveFromEnv()
      .then(() => {
        setWalletStatus(constants.ACCOUNT_STATUS.WAITING_APPROVAL)
          .then(() => {
            window.disableRefreshSafetyAlert = true;
            window.top.location.reload();
            $$.history.go("home");
          })
      }).catch(err => {
      console.log(err);
      window.disableRefreshSafetyAlert = true;
      window.top.location.reload();
      $$.history.go("home");
    });
  }

  async function setupGlobalErrorHandlers() {
    const {DwUI} = await import("./controllers/DwController.js");
    const dwUIInstance = new DwUI();
    let errHandler = openDSU.loadAPI("error");

    errHandler.observeUserRelevantMessages('warn', (notification) => {
      dwUIInstance.showToast(notification.message, {type: "warning"});
    });

    errHandler.observeUserRelevantMessages('info', (notification) => {
      dwUIInstance.showToast(notification.message, {type: "info"})
    });

    errHandler.observeUserRelevantMessages('error', (notification) => {
      let errMsg = "";
      if (notification.err && notification.err.message) {
        errMsg = notification.err.message;
      }
      let toastMsg = `${notification.message} ${errMsg}`
      dwUIInstance.showToast(toastMsg, {type: "danger"})
    });
  }

  addHook("beforeAppLoads", async () => {
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

    await setupGlobalErrorHandlers()
  });

  addHook("afterAppLoads", async () => {
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

  setConfig(getInitialConfig());


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
