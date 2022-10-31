const {DwController} = WebCardinal.controllers;

export default class QuickActionsController extends DwController {
  constructor(...props) {
    super(...props);

    this.model = {};

    debugger
    console.log("=====================================================================================================")
    console.log("=====================================================================================================")
    this.resolveNavigation();

    this.onTagClick("configuration.show", async () => {
      await UI.showConfigurationDialog(this.element);
    });
  }

  async resolveNavigation() {
    const { getEnvironmentDataAsync } = await import("../hooks/getEnvironmentData.js");
    const envData = await getEnvironmentDataAsync() || {};
    const hiddenMenuItems = envData.hiddenMenuItems || [];

    const actionElements = this.querySelectorAll("dw-action[tag]");
    Array.from(actionElements).forEach((actionElement) => {
      if (!hiddenMenuItems.includes(actionElement.getAttribute("action"))) {
        actionElement.removeAttribute("hidden");
        actionElement.addEventListener("click", () => {
          this.navigateToPageTag(actionElement.getAttribute("tag"));
        });
      }
    });
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
