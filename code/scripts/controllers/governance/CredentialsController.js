import constants from '../../constants.js';
import utils from '../../utils.js';
import { parseJWTSegments } from '../../services/JWTCredentialService.js';

const { DwController } = WebCardinal.controllers;

class CredentialsUI {
  async copyTokenToClipboard(model, target, event) {
    if (event.target.getAttribute('name') === 'eye') {
      console.error('credential.inspect triggered');
      return;
    }

    const slInputElement = target.querySelector('sl-input');
    const { value } = slInputElement;
    await slInputElement.select();
    await slInputElement.setSelectionRange(0, value.length);
    document.execCommand('copy');
    await this.ui.showToast(`Credential copied to clipboard!`, {
      duration: 1500
    });
    await slInputElement.setSelectionRange(0, 0);
    await slInputElement.blur();
  }

  getInitialViewModel() {
    return {
      credentials: [],
      areCredentialsLoaded: false,
      isImportCredential: false,
      isGenerateCredential: false
    };
  }
}

class CredentialsController extends DwController {
  constructor(...props) {
    super(...props);

    this.ui.page = new CredentialsUI();
    this.model = this.ui.page.getInitialViewModel();
    this.init();
  }

  init() {
    const waitForSharedEnclave = () => {
      console.log('Waiting for shared enclave');
      setTimeout(async () => {
        const scAPI = require('opendsu').loadAPI('sc');
        if (scAPI.sharedEnclaveExists()) {
          console.log('Shared enclave exists');
          this.model.credentials = await this.fetchCredentials();
          this.model.areCredentialsLoaded = true;
          console.log('Model: ', this.model.toObject());
        } else {
          waitForSharedEnclave();
        }
      }, 100);
    };

    this.attachViewEventListeners();
    waitForSharedEnclave();
  }

  attachViewEventListeners() {
    this.onTagClick('toggle.credential.generate', () => {
      this.model.credentialClaims = [];
      this.model.isImportCredential = false;
      this.model.isGenerateCredential = !this.model.isGenerateCredential;
    });

    this.onTagClick('toggle.credential.import', () => {
      this.model.credentialClaims = [];
      this.model.isGenerateCredential = false;
      this.model.isImportCredential = !this.model.isImportCredential;
    });

    this.onTagClick('input.paste', async (model, target) => {
      try {
        const result = await navigator.permissions.query({
          name: 'clipboard-read'
        });
        if (result.state === 'granted' || result.state === 'prompt') {
          const clipboardValue = await navigator.clipboard.readText();
          target.parentElement.value = clipboardValue;
          return { clipboardValue };
        }
        throw Error('Coping from clipboard is not possible!');
      } catch (err) {
        target.remove();
        console.log(err);
        return '';
      }
    });

    this.onTagClick('credential.select', async (...props) => {
      await this.ui.page.copyTokenToClipboard.apply(this, props);
    });

    this.onTagClick('credential.inspect', async (model) => {
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
            throw new Error('Encoding type not recognized! Cannot inspect the token!');
        }

        model.json = JSON.stringify(jsonCredential, null, 4);
        await this.ui.showDialogFromComponent('dw-dialog-view-credential', model);
      } catch (err) {
        this.ui.showToast('Encountered error: ' + err);
      }
    });

    this.onTagClick('credential.delete', async (deletedCredential) => {
      try {
        await this.deleteCredential(deletedCredential.token);
        this.model.credentials = this.model.credentials.filter(
          (credential) => credential.token !== deletedCredential.token
        );
        await this.ui.showToast(deletedCredential);
      } catch (err) {
        console.log(err);
      }
    });
  }

  async fetchCredentials() {
    return await this.storageService.filterAsync(constants.TABLES.GOVERNANCE_CREDENTIALS);
  }

  /**
   * @param {string} token
   */
  async deleteCredential(token) {
    await this.storageService.deleteRecordAsync(constants.TABLES.GOVERNANCE_CREDENTIALS, utils.getPKFromCredential(token));
  }
}

export default CredentialsController;
export { CredentialsUI };
