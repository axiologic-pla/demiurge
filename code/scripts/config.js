import {getStoredDID, didWasApproved, getWalletStatus, setWalletStatus} from "./services/BootingIdentityService.js";
import utils from "./utils.js";
import constants from "./constants.js";

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

addHook("beforeAppLoads", async () => {
  WebCardinal.wallet = {};
  const wallet = WebCardinal.wallet;

  const {getVaultDomainAsync} = await import("./hooks/getVaultDomain.js");
  const {getUserDetails} = await import("./hooks/getUserDetails.js");

  wallet.vaultDomain = await getVaultDomainAsync();
  let userData = await getUserDetails();

  wallet.userDetails = userData.userAppDetails;
  wallet.userName = userData.userName;
  userName = userData.userName;
  wallet.did = await getStoredDID();
  wallet.status = await getWalletStatus();
  wallet.managedFeatures = await utils.getManagedFeatures();
  const openDSU = require("opendsu");
  const didAPI = openDSU.loadAPI("w3cdid");
  const typicalBusinessLogicHub = didAPI.getTypicalBusinessLogicHub();
  function onUserLoginMessage(message) {
    console.log("================== Login =======================")
    debugger
    utils.addLogMessage(message.userDID, constants.OPERATIONS.LOGIN, message.userGroup, message.userId || "-", message.messageId)
        .then(() => {
        })
        .catch(err => console.log(err));
  }

  typicalBusinessLogicHub.strongSubscribe(constants.MESSAGE_TYPES.USER_LOGIN, onUserLoginMessage);

  function onUserRemovedMessage(message) {
    console.log("================== User removed =======================")

          debugger
    utils.addLogMessage(message.userDID, constants.OPERATIONS.REMOVE, message.userGroup, message.userId || "-", message.messageId)
        .then(() => {
          utils.removeSharedEnclaveFromEnv()
              .then(()=>{
                setWalletStatus(constants.ACCOUNT_STATUS.WAITING_APPROVAL)
                    .then(() => $$.history.go("home"));
              })
        })
        .catch(err => console.log(err));
  }

  typicalBusinessLogicHub.strongSubscribe(constants.MESSAGE_TYPES.USER_REMOVED, onUserRemovedMessage);


  // load Custom Components
  await import("../components/dw-header/dw-header.js");
  await import("../components/dw-menu/dw-menu.js");
  await import("../components/dw-spinner/dw-spinner.js");
  await import("../components/dw-title/dw-title.js");
  await import("../components/dw-data-grid/dw-data-grid.js");
  await import("../components/dw-clipboard-input/dw-clipboard-input.js");


  // load Demiurge base Controller
  const {DwController} = await import("./controllers/DwController.js");
  addControllers({DwController});
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
