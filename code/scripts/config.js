const { setConfig, getConfig, addControllers, addHook, navigateToPageTag } = WebCardinal.preload;
const { define } = WebCardinal.components;

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

  const { getVaultDomainAsync } = await import("./hooks/getVaultDomain.js");
  const { getUserDetails } = await import("./hooks/getUserDetails.js");
  const { getStoredDID } = await import("./services/BootingIdentityService.js");

  wallet.vaultDomain = await getVaultDomainAsync();
  wallet.userDetails = await getUserDetails();
  wallet.did = await getStoredDID();

  if (wallet.did) {
    const { default: getMessageProcessingService } = await import("./services/MessageProcessingService.js");
    const messageProcessingService = await getMessageProcessingService({ did: wallet.did });
    WebCardinal.wallet.messageProcessingService = messageProcessingService;
    try {
      messageProcessingService.readMessage();
    } catch (err) {
      console.log(err);
    }
  }

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
  const { DwController } = await import("./controllers/DwController.js");
  addControllers({ DwController });
});

addHook("beforePageLoads", "quick-actions", async () => {
  const { wallet } = WebCardinal;
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
