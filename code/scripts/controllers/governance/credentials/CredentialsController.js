import constants from '../../../constants.js';
import utils from '../../../utils.js';
import {parseJWTSegments} from '../../../services/JWTCredentialService.js';

const {DwController} = WebCardinal.controllers;

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
    /*const waitForSharedEnclave = () => {
      console.log('Waiting for shared enclave');
      setTimeout(async () => {
        const scAPI = require('opendsu').loadAPI('sc');
        if (scAPI.sharedEnclaveExists()) {
          const credentials = await this.fetchCredentials();
          this.model.credentials = credentials.map(el => {
            const tags = (el.tags || []).join(', ');
            return { ...el, tags };
          });
          this.model.hasCredentials = this.model.credentials.length > 0;
          this.model.areCredentialsLoaded = true;
        } else {
          waitForSharedEnclave();
        }
      }, 100);
    };*/
    setTimeout(async () => {
      this.storageService = await $$.promisify(this.waitForSharedEnclave)();
      const credentials = await this.fetchCredentials();
      this.model.credentials = credentials.map(el => {
        const tags = (el.tags || []).join(', ');
        return {...el, tags};
      })
      this.model.hasCredentials = this.model.credentials.length > 0;
      this.model.areCredentialsLoaded = true;
    })
    this.attachViewEventListeners();

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
          return {clipboardValue};
        }
        throw Error('Coping from clipboard is not possible!');
      } catch (err) {
        target.remove();
        this.notificationHandler.reportDevRelevantInfo("Caught an error", err);
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
        /* console.log(err);
         await this.ui.showToast('Encountered error: ' + err.message, {type: 'success'});*/
        this.notificationHandler.reportUserRelevantError('Encountered error: ', err);

      }
    });

    this.onTagClick('credential.delete', async (deletedCredential) => {
      try {
        await this.deleteCredential(deletedCredential.token);
        this.model.credentials = this.model.credentials.filter(
          (credential) => credential.token !== deletedCredential.token
        );
        this.model.hasCredentials = this.model.credentials.length > 0;
        this.model.areCredentialsLoaded = true;
        await this.ui.showToast('Credential deleted: ' + deletedCredential.token, {type: 'warning'});
      } catch (err) {
        /* console.log(err);
         await this.ui.showToast('Encountered error: ' + err.message, {type: 'success'});*/
        this.notificationHandler.reportUserRelevantError('Encountered error: ', err);

      }
    });
  }

  async fetchCredentials() {
    return await this.sharedStorageService.filterAsync(constants.TABLES.GOVERNANCE_CREDENTIALS);
  }

  /**
   * @param {string} token
   */
  async deleteCredential(token) {
    await this.sharedStorageService.deleteRecordAsync(constants.TABLES.GOVERNANCE_CREDENTIALS, utils.getPKFromContent(token));
  }
}

export default CredentialsController;
export {CredentialsUI};
