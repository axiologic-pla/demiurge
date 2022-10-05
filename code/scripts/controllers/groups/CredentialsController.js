import { parseJWTSegments } from "../../services/JWTCredentialService.js";
import constants from "../../constants.js";
import utils from "../../utils.js";

const { DwController } = WebCardinal.controllers;

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
      duration: 1500
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
      governanceCredentials: [],
      areCredentialsLoaded: false,
      isAssignCredentialOpened: false
    };

    this.onTagClick("toggle.credential.assign", () => {
      this.model.isAssignCredentialOpened = !this.model.isAssignCredentialOpened;
    });

    this.onTagClick("credential.assign", async (model) => {
      try {
        const group = this.model.selectedGroup;
        await this.storeCredential(model, group);
        this.model.credentials.push({ ...model });
        await this.shareCredentialWithMembers(group, model.token);
        this.model.isAssignCredentialOpened = false;
        this.ui.showToast("Credential assigned to group!");
      } catch (err) {
        this.ui.showToast("Encountered error: " + err);
      }
    });

    this.onTagClick("credential.select", async (...props) => {
      await ui.page.copyTokenToClipboard.apply(this, props);
    });

    this.onTagClick("credential.inspect", async (model) => {
      let jsonCredential = {};
      try {
        switch (model.encodingType) {
          case constants.JWT_ENCODING: {
            jsonCredential = parseJWTSegments(model.token);
            break;
          }
          case constants.GS1_ENCODING: {
            // TODO: Check how to decode GS1 credentials
            break;
          }
          default:
            throw new Error("Encoding type not recognized! Cannot inspect the token!");
        }

        const tags = `Credential Tags:\n${model.tags}\n\n`;
        const decodedCredential = JSON.stringify(jsonCredential, null, 4);
        model.json = tags + decodedCredential;
        await this.ui.showDialogFromComponent("dw-dialog-view-credential", model);
      } catch (err) {
        this.ui.showToast("Encountered error: " + err);
      }
    });

    this.onTagClick("credential.delete", async (deletedCredential) => {
      try {
        await this.deleteCredential(deletedCredential.token);
        this.model.credentials = this.model.credentials.filter(
          (credential) => credential.token !== deletedCredential.token
        );
        await ui.showToast("Credential deleted: " + deletedCredential);
      } catch (err) {
        this.ui.showToast("Encountered error: " + err);
      }
    });

    setTimeout(async () => {
      this.model.credentials = await this.fetchGroupCredentials(this.model.selectedGroup.did);
      this.model.governanceCredentials = await this.fetchGovernanceCredentials();
      this.model.areCredentialsLoaded = true;
    });
  }

  /**
   * @returns {Promise<*>}
   */
  async fetchGovernanceCredentials() {
    const governanceCredentials = await this.sharedStorageService.filterAsync(constants.TABLES.GOVERNANCE_CREDENTIALS);
    return governanceCredentials.map(el => {
      return { ...el, tags: el.tags.join(", ") };
    });
  }

  /**
   * @param groupDID
   * @returns {Promise<*>}
   */
  async fetchGroupCredentials(groupDID) {
    const groupCredentials = await this.sharedStorageService.filterAsync(constants.TABLES.GROUPS_CREDENTIALS, `groupDID == ${groupDID}`);
    return groupCredentials.map(el => {
      return { ...el, tags: el.tags.join(", ") };
    });
  }

  /**
   * @param {object} credentialObj
   * @param {string} credentialObj.token
   * @param {string} groupDID
   */
  async storeCredential(credentialObj, groupDID) {
    await this.sharedStorageService.insertRecordAsync(constants.TABLES.GROUPS_CREDENTIALS, utils.getPKFromCredential(credentialObj.token), {
      ...credentialObj,
      groupDID
    });
  }

  /**
   * @param {object} group
   * @param {string} group.did
   * @param {string} token
   */
  async shareCredentialWithMembers(group, token) {
    await utils.sendGroupMessage(
      this.did,
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
    await this.sharedStorageService.deleteRecordAsync(constants.TABLES.GROUPS_CREDENTIALS, utils.getPKFromCredential(token));
  }
}

export default CredentialsController;
export { CredentialsUI };
