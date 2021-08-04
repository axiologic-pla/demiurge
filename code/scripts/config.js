const { setConfig, getConfig, addControllers, addHook } = WebCardinal.preload;
const { define } = WebCardinal.components;

function setInitialTheme() {
  function applyDarkTheme() {
    const schemeElement = document.head.querySelector("[name=color-scheme]");
    schemeElement.setAttribute(
        "content",
        `${schemeElement.getAttribute("content")} dark`
    );
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
  const { init: initServices } = await import("/scripts/hooks/initServices.js");
  const { dsuStorage, storageService, identity, messageProcessingService } = await initServices();

  window.dwServices = {
    dsuStorage,
    storageService,
    identity,
    messageProcessingService,
  };
  messageProcessingService.readMessage();

  // setInitialTheme();

  await import("/components/dw-header/dw-header.js");
  await import("/components/dw-menu/dw-menu.js");
  await import("/components/dw-spinner/dw-spinner.js");
  await import("/components/dw-title/dw-title.js");
  await import("/components/dw-data-grid/dw-data-grid.js");
  await import("/components/dw-clipboard-input/dw-clipboard-input.js");
  await import('/components/dw-did-generator/dw-did-generator.js');

  const { default: DwController } = await import("/scripts/controllers/DwController.js");
  addControllers({ DwController });
});

setConfig(
  (() => {
    const config = getConfig();
    config.translations = false;
    config.logLevel = "none";
    return config;
  })()
);

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
