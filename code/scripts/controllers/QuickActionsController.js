const {DwController} = WebCardinal.controllers;

export default class QuickActionsController extends DwController {
  constructor(...props) {
    super(...props);

    this.model = {};

    this.resolveNavigation();

    this.onTagClick("configuration.show", async () => {
      await UI.showConfigurationDialog(this.element);
    });
  }

  async resolveNavigation() {
    const actionElements = this.querySelectorAll("dw-action[tag]:not([hidden])");
    Array.from(actionElements).forEach((actionElement) => {
      actionElement.addEventListener("click", () => {
        this.navigateToPageTag(actionElement.getAttribute("tag"));
      });
    });

    const { getEnvironmentDataAsync } = await import("../hooks/getEnvironmentData.js");
    const envData = await getEnvironmentDataAsync() || {};
    const enableGovernance = envData.enableGovernance || false;

    if (enableGovernance) {
      const governanceElement = this.querySelector("dw-action[tag='governance']");
      if (governanceElement) {
        governanceElement.removeAttribute("hidden");
        governanceElement.addEventListener("click", () => {
          this.navigateToPageTag("governance");
        });
      }
    }
  }
}

const UI = {
  showConfigurationDialog: async (container) => {
    const dialogElement = document.createElement("dw-dialog-configuration");
    dialogElement.setAttribute("controller", "ConfigurationController");
    container.append(dialogElement);
    await dialogElement.componentOnReady();

    const slElement = dialogElement.querySelector("sl-dialog");
    setTimeout(() => {
      slElement.show();
    }, 25);

    slElement.addEventListener("sl-hide", () => {
      dialogElement.remove();
    });
  },
};
