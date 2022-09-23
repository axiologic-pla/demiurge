import constants from '../../constants.js';
import utils from '../../utils.js';

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
      let inputElement = document.querySelector('#import-credential-input');
      const encodedCredential = inputElement.value;
      try {
        if (!encodedCredential) {
          throw new Error('Encoded Credential is empty.');
        }

        // TODO: Perform validation of the credential??
        const tokenModel = { issuer: this.did, token: encodedCredential, encodingType: this.selectedEncodingType };
        this.storeCredential(tokenModel);
        this.model.credentials.push(tokenModel);
      } catch (e) {
        await this.ui.showToast('Could not import credential because: ' + e.message);
      }
    });
  }

  async storeCredential(model) {
    // Store credential, cu ceva uid sau hash
    await this.storageService.insertRecordAsync(constants.TABLES.GOVERNANCE_CREDENTIALS, utils.getPKFromCredential(model.token), model);
  }
}

export default ImportCredentialController;
export { ImportCredentialUI };
