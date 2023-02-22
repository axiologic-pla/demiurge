const { DwController } = WebCardinal.controllers;
import constants from "../constants.js";
import utils from "../utils.js";

const promisify = utils.promisify;

class CredentialsUI {
  async copyTokenToClipboard(model, target, event) {
    // credential.inspect is triggered
    // event.target (actual target)
    // target from callback (actual currentTarget)
    if (event.target.getAttribute("name") === "eye") {
      return;
    }

    const slInputElement = target.querySelector("sl-input");
    const { value } = slInputElement;
    await slInputElement.select();
    await slInputElement.setSelectionRange(0, value.length);
    document.execCommand("copy");
    // await this.ui.showToast(`Credential copied to clipboard!`, {
    //   duration: 1500,
    // });
    await slInputElement.setSelectionRange(0, 0);
    await slInputElement.blur();
  }
}

class CredentialsController extends DwController {
  constructor(...props) {
    super(...props);
    const { ui } = this;
    const { selectedGroup } = this.getState();

    ui.page = new CredentialsUI();

    this.model = {
      selectedGroup,
      credentials: [],
      areCredentialsLoaded: false,
    };

    setTimeout(async () => {
      try {
        this.storageService = await $$.promisify(this.waitForSharedEnclave)();
        this.model.credentials = await this.storageService.filterAsync(constants.TABLES.GROUPS_CREDENTIALS);
        this.updateState("credentials", this.model.credentials);
        this.model.areCredentialsLoaded = true;
      } catch (err) {
        console.error(err);
      }
    });

    this.onTagClick("credential.select", async (...props) => {
      await ui.page.copyTokenToClipboard.apply(this, props);
    });

    this.onTagClick("credential.inspect", async (model) => {
      const crypto = require("opendsu").loadAPI("crypto");
      const jsonCredential = await promisify(crypto.parseJWTSegments)(model.credential);
      jsonCredential.signature = $$.Buffer.from(jsonCredential.signature).toString("base64");
      model.jsonCredential = JSON.stringify(jsonCredential, null, 4);
      await this.ui.showDialogFromComponent("dw-dialog-view-credential", model);
    });

    this.onTagClick("credential.delete", async (deletedCredential, ...props) => {
      console.log({ props });

      this.model.credentials = this.model.credentials.filter(
        (credential) => credential.credential !== deletedCredential.credential
      );

      await this.storageService.deleteRecordAsync(
        constants.TABLES.GROUPS_CREDENTIALS,
        utils.getPKFromContent(deletedCredential.credential)
      );

      // await ui.showToast(deletedCredential);
    });
  }
}

export default CredentialsController;
export { CredentialsUI };
