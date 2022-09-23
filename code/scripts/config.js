import {getStoredDID} from "./services/BootingIdentityService.js";
import utils from "./utils.js";
import constants from './constants.js';

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

  if (wallet.did) {
    const communicationService = getCommunicationService();
    communicationService.waitForMessage(wallet.did, () => {
    });
  }
  // if (wallet.did) {
  //   const { default: getMessageProcessingService } = await import("./services/MessageProcessingService.js");
  //   const messageProcessingService = await getMessageProcessingService({ did: wallet.did });
  //   WebCardinal.wallet.messageProcessingService = messageProcessingService;
  //   try {
  //     messageProcessingService.readMessage();
  //   } catch (err) {
  //     console.log(err);
  //   }
  // }

  // setInitialTheme();

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

  document.querySelectorAll('webc-app-menu-item').forEach(item => {
    if (!item.querySelector("a")) {
      return
    }
    item.setAttribute("icon-name", item.querySelector("a").innerHTML)
    if (item.querySelector("a").innerHTML === "My Identities") {
      let iconDiv = document.createElement("div");
      iconDiv.innerHTML = `<sl-icon name="person-fill" class="menu-item-icon"></sl-icon>`;
      item.parentElement.insertBefore(iconDiv, item);
    }

    if (item.querySelector("a").innerHTML === "Groups") {
      let iconDiv = document.createElement("div");
      iconDiv.innerHTML = `<sl-icon name="people-fill" class="menu-item-icon"></sl-icon>`;
      item.parentElement.insertBefore(iconDiv, item);
    }

    if (item.querySelector("a").innerHTML === "Governance") {
      let iconDiv = document.createElement("div");
      iconDiv.innerHTML = `<sl-icon name="clouds-fill" class="menu-item-icon"></sl-icon>`;
      item.parentElement.insertBefore(iconDiv, item);
    }

    if (item.querySelector("a").innerHTML === "Audit") {
      let iconDiv = document.createElement("div");
      iconDiv.innerHTML = `<sl-icon name="person-lines-fill" class="menu-item-icon"></sl-icon>`;
      item.parentElement.insertBefore(iconDiv, item);
    }

  });
  if (WebCardinal.wallet.did) {
    const groupName = WebCardinal.wallet.groupName || constants.EPI_ADMIN_GROUP;
    await utils.addLogMessage(WebCardinal.wallet.did, "login", groupName, "-");
  }
});

addHook("beforePageLoads", "quick-actions", async () => {
  const {wallet} = WebCardinal;
  if (!wallet.did) {
    await navigateToPageTag("booting-identity");
    return;
  }

  const activeElement = document.querySelector('webc-app-menu-item[active]');
  if (activeElement) {
    activeElement.removeAttribute('active');
  }
});

setConfig(getInitialConfig());


define("dw-action");
define("dw-subdomains");
define("dw-dialog-configuration");
define("dw-dialog-view-credential");
define('dw-dialog-booting-identity');
define('dw-dialog-add-domain');
define('dw-dialog-waiting-approval');
define('dw-dialog-initialising');
define('dw-dialog-group-members-update');
