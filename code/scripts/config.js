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

  const { getVaultDomainAsync } = await import("/scripts/hooks/getVaultDomain.js");
  const { getUserDetails } = await import("/scripts/hooks/getUserDetails.js");
  const { getStoredDID } = await import("/scripts/services/BootingIdentityService.js");

  wallet.vaultDomain = await getVaultDomainAsync();
  wallet.userDetails = await getUserDetails();
  wallet.did = await getStoredDID();

  if (wallet.did) {
    const { default: getMessageProcessingService } = await import("/scripts/services/MessageProcessingService.js");
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
  await import("/components/dw-header/dw-header.js");
  await import("/components/dw-menu/dw-menu.js");
  await import("/components/dw-spinner/dw-spinner.js");
  await import("/components/dw-title/dw-title.js");
  await import("/components/dw-data-grid/dw-data-grid.js");
  await import("/components/dw-clipboard-input/dw-clipboard-input.js");
  await import("/components/dw-did-generator/dw-did-generator.js");

  // load Demiurge base Controller
  const { DwController } = await import("/scripts/controllers/DwController.js");
  addControllers({ DwController });
});

addHook("beforePageLoads", "quick-actions", async () => {
  const { wallet } = WebCardinal;
  if (!wallet.did) {
    await navigateToPageTag("booting-identity");
  }
});

setConfig(getInitialConfig());

define("dw-page");
define("dw-action");
define("dw-groups");
define("dw-subdomains");
define("dw-dialog-configuration");
define("dw-dialog-subdomain-delete");
define("dw-dialog-edit-member");
define("dw-dialog-groups-fab");
define("dw-dialog-view-credential");
define("dw-dialog-new-group");
define("dw-dialog-did-generator");
define('dw-dialog-booting-identity');