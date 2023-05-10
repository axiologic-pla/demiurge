import constants from '../../../constants.js';
import utils from '../../../utils.js';

const { DwController } = WebCardinal.controllers;

class ImportCredentialUI {
  getInitialViewModel() {
    return {};
  }
}

class ImportCredentialController extends DwController {
  constructor(...props) {
    super(...props);

    this.init();
  }

  init() {
    this.selectedEncodingType = constants.OTHER_ENCODING;
    this.ui.page = new ImportCredentialUI();
    this.model = this.ui.page.getInitialViewModel();
    this.attachViewEventListeners();
  }

  attachViewEventListeners() {
    this.attachDropdownListener();
    this.attachImportCredentialListener();
  }

  attachDropdownListener() {
    const dropdown = document.querySelector('#import-encoding-type');
    dropdown.addEventListener('sl-select', event => {
      this.selectedEncodingType = event.detail.item.value;
    });
  }

  attachImportCredentialListener() {
    this.onTagClick('credential.import', async () => {
      const credentialInputElement = document.querySelector('#import-credential-input');
      const tagsInputElement = document.querySelector('#tags-input');
      const encodedCredential = credentialInputElement.value;
      let tags = tagsInputElement.value;
      try {
        if (!encodedCredential) {
          throw new Error('Encoded Credential is empty.');
        }

        // TODO: Perform validation of the credential??
        if (tags.trim().length > 0) {
          tags = tags.split(",").map(tag => tag.trim());
        }
        const tokenModel = { issuer: this.did, token: encodedCredential, encodingType: this.selectedEncodingType, tags };
        this.storeCredential(tokenModel);
        this.model.credentials.push(tokenModel);
        this.model.hasCredentials = this.model.credentials.length > 0;
        this.model.areCredentialsLoaded = true;
      } catch (e) {
        this.notificationHandler.reportUserRelevantError('Could not import credential because: ', e);
      }
    });
  }

  async storeCredential(model) {
    // Store credential, cu ceva uid sau hash
    await this.sharedStorageService.insertRecordAsync(constants.TABLES.GOVERNANCE_CREDENTIALS, utils.getPKFromContent(model.token), model);
  }
}

export default ImportCredentialController;
export { ImportCredentialUI };
