import {getStoredDID, didWasApproved} from "./services/BootingIdentityService.js";
import {getCommunicationService} from "./services/CommunicationService.js";
import utils from "./utils.js";
import constants from "./constants.js";

const {setConfig, getConfig, addControllers, addHook, navigateToPageTag} = WebCardinal.preload;
const {define} = WebCardinal.components;

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
  const {getStoredDID} = await import("./services/BootingIdentityService.js");
  const {getCommunicationService} = await import("./services/CommunicationService.js");

  wallet.vaultDomain = await getVaultDomainAsync();
  wallet.userDetails = await getUserDetails();
  wallet.did = await getStoredDID();

  // load Custom Components
  await import("../components/dw-header/dw-header.js");
  await import("../components/dw-menu/dw-menu.js");
  await import("../components/dw-spinner/dw-spinner.js");
  await import("../components/dw-title/dw-title.js");
  await import("../components/dw-data-grid/dw-data-grid.js");
  await import("../components/dw-clipboard-input/dw-clipboard-input.js");
  await import("../components/did-generator/did-generator.js");

  // load Demiurge base Controller
  const {DwController} = await import("./controllers/DwController.js");
  addControllers({DwController});
});

addHook("afterAppLoads", async () => {
  const { getEnvironmentDataAsync } = await import("./hooks/getEnvironmentData.js");
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
      if(!enableGovernance) {
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

addHook("beforePageLoads", "quick-actions", async () => {
  const scAPI = require("opendsu").loadAPI("sc");
  const did = await getStoredDID();
  if (!did) {
    await navigateToPageTag("booting-identity");
    return;
  }

  let sharedEnclave;
  try {
    sharedEnclave = await $$.promisify(scAPI.getSharedEnclave)();
  } catch (e) {
    console.log("Failed to get shared enclave. Waiting for approval message ...");
  }

  const __logLoginAction = async () => {
    let groups = [];
    try {
      groups = await $$.promisify(sharedEnclave.filter)(constants.TABLES.GROUPS);
      const adminGroup = groups.find((gr) => gr.accessMode === constants.ADMIN_ACCESS_MODE || gr.name === constants.EPI_ADMIN_GROUP_NAME) || {};
      await utils.addLogMessage(did, "login", adminGroup.name, "-");
    } catch (e) {
      console.log("Could not log user login action ", e);
    }
    const activeElement = document.querySelector("webc-app-menu-item[active]");
    if (activeElement) {
      activeElement.removeAttribute("active");
    }
  }

  if(sharedEnclave){
    return await __logLoginAction();
  }

  const didApproved = await didWasApproved(did);
  if (!didApproved) {
    await navigateToPageTag("booting-identity");
    return;
  }

  if (!sharedEnclave) {
    return getCommunicationService().waitForMessage(did, async () => {
      await __logLoginAction();
    });
  }

  await __logLoginAction();
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
define("dw-dialog-group-members-update");
