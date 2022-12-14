import { parseJWTSegments } from '../../services/JWTCredentialService.js';
import constants from '../../constants.js';
import utils from '../../utils.js';

const { DwController } = WebCardinal.controllers;

class CredentialsUI {
  async copyTokenToClipboard(model) {
    const tempText = document.createElement('input');
    tempText.value = model.token;
    document.body.appendChild(tempText);
    tempText.select();

    document.execCommand('copy');
    document.body.removeChild(tempText);
    await this.ui.showToast(`Credential copied to clipboard!`, {duration: 1500});
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
      hasCredentials: false,
      areCredentialsLoaded: false,
      isAssignCredentialOpened: false,
      hasGovernanceCredentials: false
    };

    this.onTagClick('toggle.credential.assign', () => {
      this.model.isAssignCredentialOpened = !this.model.isAssignCredentialOpened;
    });

    this.onTagClick('credential.assign', async (model) => {
      try {
        const group = this.model.selectedGroup;
        await this.storeCredential(model, group.did);
        this.model.credentials.push({ ...model });
        await this.shareCredentialWithMembers(group, model.token);
        await this.deleteCredentialFromGovernanceTable(model.token);
        this.model.hasCredentials = true;
        this.model.isAssignCredentialOpened = false;
        await this.ui.showToast('Credential assigned to group!', {type: 'success'});
      } catch (err) {
        console.log(err);
        await this.ui.showToast('Encountered error: ' + err, {type: 'danger'});
      }
    });

    this.onTagClick('credential.select', async (...props) => {
      await ui.page.copyTokenToClipboard.apply(this, props);
    });

    this.onTagClick('credential.inspect', async (model) => {
      let jsonCredential = {};
      try {
        switch (model.encodingType) {
          case constants.JWT_ENCODING: {
            jsonCredential = parseJWTSegments(model.token);
            jsonCredential.jwtSignature = $$.Buffer.from(jsonCredential.jwtSignature).toString("base64");
            break;
          }
          case constants.GS1_ENCODING: {
            // TODO: Check how to decode GS1 credentials
            break;
          }
          default:
            throw new Error('Encoding type not recognized! Cannot inspect the token!');
        }

        const tags = `Credential Tags:\n${model.tags}\n\n`;
        const decodedCredential = JSON.stringify(jsonCredential, null, 4);
        model.json = tags + decodedCredential;
        await this.ui.showDialogFromComponent('dw-dialog-view-credential', model);
      } catch (err) {
        console.log(err);
        await this.ui.showToast('Encountered error: ' + err, {type: 'danger'});
      }
    });

    this.onTagClick('credential.delete', async (deletedCredential) => {
      try {
        if (deletedCredential.credentialType === constants.CREDENTIAL_TYPES.WALLET_AUTHORIZATION) {
          throw new Error('Wallet Authorization credential cannot be deleted!');
        }

        await this.deleteCredential(deletedCredential.token);
        this.model.credentials = this.model.credentials.filter(
          (credential) => credential.token !== deletedCredential.token
        );
        this.model.hasCredentials = this.model.credentials.length > 0;
        this.model.areCredentialsLoaded = true;
        await this.ui.showToast('Credential deleted: ' + deletedCredential.token, {type: 'warning'});
      } catch (err) {
        console.log(err);
        await this.ui.showToast('Encountered error: ' + err, {type: 'danger'});
      }
    });

    // setTimeout(async () => {
    //   this.model.credentials = await this.fetchGroupCredentials(this.model.selectedGroup.did);
    //   this.model.governanceCredentials = await this.fetchGovernanceCredentials();
    //   this.model.hasCredentials = this.model.credentials.length > 0;
    //   this.model.hasGovernanceCredentials = this.model.governanceCredentials.length > 0;
    //   this.model.areCredentialsLoaded = true;
    // });
  }

  /**
   * @returns {Promise<*>}
   */
  async fetchGovernanceCredentials() {
    const governanceCredentials = await this.sharedStorageService.filterAsync(constants.TABLES.GOVERNANCE_CREDENTIALS);
    return governanceCredentials.map(el => {
      const tags = (el.tags || []).join(', ');
      return { ...el, tags };
    });
  }

  /**
   * @param groupDID
   * @returns {Promise<*>}
   */
  async fetchGroupCredentials(groupDID) {
    const groupCredentials = await this.sharedStorageService.filterAsync(constants.TABLES.GROUPS_CREDENTIALS, `groupDID == ${groupDID}`);
    return groupCredentials.map(el => {
      const tags = (el.tags || []).join(', ');
      return { ...el, tags };
    });
  }

  /**
   * @param {object} credentialObj
   * @param {string} credentialObj.token
   * @param {string} groupDID
   */
  async storeCredential(credentialObj, groupDID) {
    credentialObj.tags = credentialObj.tags.split(', ');
    await this.sharedStorageService.insertRecordAsync(constants.TABLES.GROUPS_CREDENTIALS, utils.getPKFromContent(credentialObj.token), {
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

  async deleteCredentialFromGovernanceTable(token) {
    await this.sharedStorageService.deleteRecordAsync(constants.TABLES.GOVERNANCE_CREDENTIALS, utils.getPKFromContent(token));
    this.model.governanceCredentials = this.model.governanceCredentials.filter(
      (credential) => credential.token !== token
    );
    this.model.hasGovernanceCredentials = this.model.governanceCredentials.length > 0;
  }

  /**
   * @param {string} token
   */
  async deleteCredential(token) {
    await this.sharedStorageService.deleteRecordAsync(constants.TABLES.GROUPS_CREDENTIALS, utils.getPKFromContent(token));
  }
}

export default CredentialsController;
export { CredentialsUI };
