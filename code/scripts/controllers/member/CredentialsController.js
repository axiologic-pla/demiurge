import {CredentialsUI} from '../groups/CredentialsController.js';
import {parseJWTSegments} from '../../services/JWTCredentialService.js';
import constants from '../../constants.js';
import utils from '../../utils.js';

const {DwController} = WebCardinal.controllers;

class CredentialsController extends DwController {
  constructor(...props) {
    super(...props);
    const {ui, errHandler} = this;
    const {selectedGroup, selectedMember} = this.getState();

    ui.page = new CredentialsUI();

    this.model = {
      selectedGroup,
      selectedMember,
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

    this.onTagClick('member.credential.assign', async (model) => {
      try {
        const group = this.model.selectedGroup;
        const member = this.model.selectedMember;
        await this.storeCredential(model, member.did);
        this.model.credentials.push({...model});
        await this.shareCredential(group, member, model.token);
        await this.deleteCredentialFromGovernanceTable(model.token);
        this.model.hasCredentials = true;
        this.model.isAssignCredentialOpened = false;
        await this.ui.showToast('Credential assigned to member!', {type: 'success'});
      } catch (err) {
        this.notificationHandler.reportUserRelevantError("Encountered error: ", err);
      }
    });

    this.onTagClick('member.credential.select', async (...props) => {
      await ui.page.copyTokenToClipboard.apply(this, props);
    });

    this.onTagClick('member.credential.inspect', async (model) => {
      let jsonCredential = {};
      try {
        switch (model.encodingType) {
          case constants.JWT_ENCODING: {
            jsonCredential = parseJWTSegments(model.token);
            jsonCredential.jwtSignature = $$.Buffer.from(jsonCredential.jwtSignature).toString('base64');
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
        await this.ui.showDialogFromComponent('dw-dialog-view-credential', model, {parentElement: this.element});
      } catch (err) {
        this.notificationHandler.reportUserRelevantError("Encountered error: ", err);
      }
    });

    this.onTagClick('member.credential.delete', async (deletedCredential) => {
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
        this.notificationHandler.reportUserRelevantError("Encountered error: ", err);
      }
    });

    setTimeout(async () => {
      this.storageService = await $$.promisify(this.waitForSharedEnclave)();
      this.model.credentials = await this.fetchCredentials(this.model.selectedMember.did);
      this.model.governanceCredentials = await this.fetchGovernanceCredentials();
      this.model.hasCredentials = this.model.credentials.length > 0;
      this.model.hasGovernanceCredentials = this.model.governanceCredentials.length > 0;
      this.model.areCredentialsLoaded = true;
    });
  }

  async fetchCredentials(memberDID) {
    const memberCredentials = await this.storageService.filterAsync(constants.TABLES.USER_CREDENTIALS, `memberDID == ${memberDID}`);
    return memberCredentials.map(el => {
      const tags = (el.tags || []).join(', ');
      return {...el, tags};
    });
  }

  /**
   * @returns {Promise<*>}
   */
  async fetchGovernanceCredentials() {
    const governanceCredentials = await this.storageService.filterAsync(constants.TABLES.GOVERNANCE_CREDENTIALS);
    return governanceCredentials.map(el => {
      const tags = (el.tags || []).join(', ');
      return {...el, tags};
    });
  }

  /**
   * @param {object} credentialObj
   * @param {string} credentialObj.token
   * @param {string} memberDID
   */
  async storeCredential(credentialObj, memberDID) {
    credentialObj.tags = credentialObj.tags.split(', ');
    await this.storageService.insertRecordAsync(constants.TABLES.USER_CREDENTIALS, utils.getPKFromContent(credentialObj.token), {
      ...credentialObj,
      memberDID: memberDID
    });
  }

  async deleteCredentialFromGovernanceTable(token) {
    await this.storageService.deleteRecordAsync(constants.TABLES.GOVERNANCE_CREDENTIALS, utils.getPKFromContent(token));
    this.model.governanceCredentials = this.model.governanceCredentials.filter(
      (credential) => credential.token !== token
    );
    this.model.hasGovernanceCredentials = this.model.governanceCredentials.length > 0;
  }

  /**
   * @param {string} token
   */
  async deleteCredential(token) {
    await this.storageService.deleteRecordAsync(constants.TABLES.USER_CREDENTIALS, utils.getPKFromContent(token));
  }

  async shareCredential(group, member, token) {
    await utils.sendUserMessage(
      this.did,
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
export {CredentialsUI};
