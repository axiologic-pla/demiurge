import constants from "../../constants.js";
import utils from "../../utils.js";

const { DwController } = WebCardinal.controllers;
const { promisify } = utils;

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
    await this.ui.showToast(`Credential copied to clipboard!`, {
      duration: 1500,
    });
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

    this.onTagClick("credential.add", async () => {
      try {
        const group = this.model.selectedGroup;
        const credential = await this.generateCredential(group);
        await this.storeCredential(group, credential);
        this.model.credentials.push({ token: credential });
        await this.shareCredentialWithMembers(group, credential);
        await ui.showToast(credential);
      } catch (err) {
        console.log(err);
      }
    });

    this.onTagClick("credential.select", async (...props) => {
      await ui.page.copyTokenToClipboard.apply(this, props);
    });

    this.onTagClick("credential.inspect", async (model) => {
      try {
        const crypto = require("opendsu").loadAPI("crypto");
        const jsonCredential = await promisify(crypto.parseJWTSegments)(model.token);
        jsonCredential.signature = $$.Buffer.from(jsonCredential.signature).toString("base64");
        model.json = JSON.stringify(jsonCredential, null, 4);
        await ui.showDialogFromComponent("dw-dialog-view-credential", model);
      } catch (err) {
        console.log(err);
      }
    });

    this.onTagClick("credential.delete", async (deletedCredential) => {
      try {
        await this.deleteCredential(deletedCredential.token);
        this.model.credentials = this.model.credentials.filter(
          (credential) => credential.token !== deletedCredential.token
        );
        await ui.showToast(deletedCredential);
      } catch (err) {
        console.log(err);
      }
    });

    setTimeout(async () => {
      this.model.credentials = await this.fetchCredentials();
      this.model.areCredentialsLoaded = true;
    });
  }

  async fetchCredentials() {
    return await this.storageService.filterAsync(constants.TABLES.GROUPS_CREDENTIALS);
  }

  /**
   * @param {object} group
   * @param {string} group.did
   */
  async generateCredential(group) {
    const crypto = require("opendsu").loadAPI("crypto");
    return await promisify(crypto.createCredentialForDID)(this.identity.did, group.did);
  }

  /**
   * @param {object} group
   * @param {string} group.did
   * @param {string} token
   */
  async storeCredential(group, token) {
    await this.storageService.insertRecordAsync(constants.TABLES.GROUPS_CREDENTIALS, utils.getPKFromCredential(token), {
      issuer: this.identity.did,
      groupDID: group.did,
      token,
    });
  }

  /**
   * @param {object} group
   * @param {string} group.did
   * @param {string} token
   */
  async shareCredentialWithMembers(group, token) {
    await utils.sendGroupMessage(
      this.identity.did,
      group,
      token,
      constants.CONTENT_TYPE.CREDENTIAL,
      constants.RECIPIENT_TYPES.GROUP_RECIPIENT,
      constants.OPERATIONS.ADD
    );
  }

  /**
   * @param {string} token
   */
  async deleteCredential(token) {
    await this.storageService.deleteRecordAsync(constants.TABLES.GROUPS_CREDENTIALS, utils.getPKFromCredential(token));
  }
}

export default CredentialsController;
export { CredentialsUI };
