import constants from '../../../constants.js';
import utils from '../../../utils.js';
import { getCredentialService } from '../../../services/JWTCredentialService.js';

const { DwController } = WebCardinal.controllers;

class GenerateCredentialUI {
  getInitialViewModel() {
    return {
      credentialClaims: []
    };
  }
}

class GenerateCredentialController extends DwController {
  constructor(...props) {
    super(...props);

    this.init();
  }

  init() {
    this.selectedEncodingType = constants.JWT_ENCODING;
    this.ui.page = new GenerateCredentialUI();
    this.model = this.ui.page.getInitialViewModel();

    this.JWTCredentialService = getCredentialService();

    this.attachViewEventListeners();
  }

  attachViewEventListeners() {
    this.attachDropdownListener();
    this.attachCredentialClaimsListeners();
    this.attachGenerateCredentialListener();
  }

  attachDropdownListener() {
    const dropdown = document.querySelector('#generate-encoding-type');
    dropdown.addEventListener('sl-select', event => {
      this.selectedEncodingType = event.detail.item.value;
    });
  }

  attachCredentialClaimsListeners() {
    this.onTagClick('credential.remove.claim', (evt, target, model) => {
      const selectedClaimIndex = this.model.credentialClaims.findIndex(cl => cl.uid === model.uid);
      this.model.credentialClaims.splice(selectedClaimIndex, 1);
    });

    this.onTagClick('credential.add.claim', () => {
      const inputsCredentialClaims = document.querySelectorAll('#public-claims sl-input');
      for (let index = 0; index < inputsCredentialClaims.length; index = index + 2) {
        let name = inputsCredentialClaims[index]?.value;
        let value = inputsCredentialClaims[index + 1]?.value;
        this.model.credentialClaims[index / 2] = { name: name, value: value };
      }

      this.model.credentialClaims.push({
        name: '',
        value: '',
        uid: utils.uuidv4()
      });
    });
  }

  attachGenerateCredentialListener() {
    this.onTagClick('credential.generate', async () => {
      const subjectInputElement = document.querySelector('#subject-input');
      const tagsInputElement = document.querySelector('#tags-input');
      const subjectDID = subjectInputElement.value;
      let tags = tagsInputElement.value;
      try {
        if (!subjectDID) {
          throw new Error('Subject DID is empty!');
        }

        const isValidDID = await utils.isValidDID(subjectDID);
        if (!isValidDID) {
          throw new Error('Subject DID is not valid or does not exist! ' + subjectDID);
        }

        const credentialOptions = { subjectClaims: {} };
        const inputsCredentialClaims = document.querySelectorAll('#public-claims sl-input');
        for (let index = 0; index < inputsCredentialClaims.length; index = index + 2) {
          let name = inputsCredentialClaims[index]?.value;
          let value = inputsCredentialClaims[index + 1]?.value;
          // Add only the claims that have a name and a value
          if (name.trim().length > 0 && value.trim().length > 0) {
            credentialOptions.subjectClaims[name] = value;
          }
        }

        const encodedJWTToken = await this.JWTCredentialService.createVerifiableCredential(this.did, subjectDID, credentialOptions);
        if (tags.trim().length > 0) {
          tags = tags.split(",").map(tag => tag.trim());
        }
        const tokenModel = { issuer: this.did, token: encodedJWTToken, encodingType: this.selectedEncodingType, tags };
        this.storeCredential(tokenModel);
        this.model.credentials.push(tokenModel);
      } catch (err) {
        await this.ui.showToast('Could not import credential because: ' + err.message);
      }
    });
  }

  async storeCredential(model) {
    await this.sharedStorageService.insertRecordAsync(constants.TABLES.GOVERNANCE_CREDENTIALS, utils.getPKFromCredential(model.token), model);
  }
}

export default GenerateCredentialController;
export { GenerateCredentialUI };
