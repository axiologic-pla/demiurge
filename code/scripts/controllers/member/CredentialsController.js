import { CredentialsUI } from "../groups/CredentialsController.js";
import constants from "../../constants.js";
import utils from "../../utils.js";

const { DwController } = WebCardinal.controllers;
const { promisify } = utils;

class CredentialsController extends DwController {
  constructor(...props) {
    super(...props);
    const { ui } = this;
    const { selectedGroup, selectedMember } = this.getState();

    ui.page = new CredentialsUI();

    this.model = {
      selectedGroup,
      selectedMember,
      credentials: [],
      areCredentialsLoaded: false,
    };

    this.onTagClick("credential.add", async () => {
      try {
        const group = this.model.selectedGroup;
        const member = this.model.selectedMember;
        const credential = await this.generateCredential(member);
        await this.storeCredential(member, credential);
        this.model.credentials.push({ token: credential });
        await this.shareCredential(group, member, credential);
        await ui.showToast(credential, {type: 'success'});
      } catch (err) {
        await ui.showToast("Encountered error: " + err.message, {type: 'danger'});
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
        await ui.showDialogFromComponent("dw-dialog-view-credential", model, { parentElement: this.element });
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
        await ui.showToast(deletedCredential, {type: 'warning'});
      } catch (err) {
        await ui.showToast("Encountered error: " + err.message, {type: 'danger'});
      }
    });

    setTimeout(async () => {
      this.model.credentials = await this.fetchCredentials();
      this.model.areCredentialsLoaded = true;
    });
  }

  async fetchCredentials() {
    return await this.storageService.filterAsync(constants.TABLES.USER_CREDENTIALS);
  }

  /**
   * @param {object} member
   * @param {string} member.did
   */
  async generateCredential(member) {
    const crypto = require("opendsu").loadAPI("crypto");
    return await promisify(crypto.createCredentialForDID)(this.identity.did, member.did);
  }

  /**
   * @param {object} member
   * @param {string} member.did
   * @param {string} token
   */
  async storeCredential(member, token) {
    await this.storageService.insertRecordAsync(constants.TABLES.USER_CREDENTIALS, utils.getPKFromContent(token), {
      issuer: this.identity.did,
      memberDID: member.did,
      token,
    });
  }

  /**
   * @param {string} token
   */
  async deleteCredential(token) {
    await this.storageService.deleteRecordAsync(constants.TABLES.USER_CREDENTIALS, utils.getPKFromContent(token));
  }

  async shareCredential(group, member, token) {
    await utils.sendUserMessage(
      this.identity.did,
      group,
      member,
      token,
      constants.CONTENT_TYPE.CREDENTIAL,
      constants.RECIPIENT_TYPES.USER_RECIPIENT,
      constants.OPERATIONS.ADD
    );
  }
}

export default CredentialsController;
export { CredentialsUI };
