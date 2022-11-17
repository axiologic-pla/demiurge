import constants from '../../../constants.js';
import utils from '../../../utils.js';
import FileManagementService from '../../../services/FileManagementService.js';
import { getVotingServiceInstance } from '../../../services/VotingService.js';

const { DwController } = WebCardinal.controllers;

class PerformVoteUI {
  getInitialViewModel() {
    return {};
  }
}

class PerformVoteController extends DwController {
  constructor(...props) {
    super(...props);

    this.ui.page = new PerformVoteUI();
    this.model = this.ui.page.getInitialViewModel();
    this.init();
  }

  init() {
    this.attachViewEventListeners();

    this.votingService = getVotingServiceInstance();
    this.fileManagementService = new FileManagementService();

    const selectedVotingSession = this.model.toObject('selectedVotingSession') || {};
    this.model.selectedVotingSession.isFixedStructure = selectedVotingSession.submitVotingType === 'fixed';
    this.model.selectedVotingSession.hasDocumentation = selectedVotingSession.candidateDocumentationName
      && selectedVotingSession.candidateDocumentationName.trim().length > 0;
  }

  attachViewEventListeners() {
    this.onTagClick('history.go.back', (model, target, event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      this.model.isAddVoteOpened = false;
      this.model.selectedVotingSession = null;
    });

    this.onTagClick('vote.document.download', async (model, target, event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      const { candidateDocumentationName, candidateDocumentationSSI } = model.selectedVotingSession;
      await this.fileManagementService.prepareDownloadFromDsu(candidateDocumentationSSI, candidateDocumentationName);
      this.fileManagementService.downloadFileToDevice();
    });

    this.onTagClick('vote.add.submit', async (model, target, event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      try {
        const checkedAnswers = [];
        const checkboxes = document.querySelectorAll('.answers-wrapper sl-checkbox');
        for (let index = 0; index < checkboxes.length; ++index) {
          let check = checkboxes[index];
          if (check.checked) {
            checkedAnswers.push(check.id);
          }
        }

        const radios = document.querySelectorAll('.answers-container sl-radio');
        for (let index = 0; index < radios.length; ++index) {
          let radio = radios[index];
          if (radio.checked) {
            checkedAnswers.push(radio.value);
          }
        }

        if (checkedAnswers.length === 0) {
          throw new Error('No answer was checked!');
        }

        const myVoteModel = {
          uid: this.model.selectedVotingSession.uid,
          answers: [...checkedAnswers]
        };
        await this.submitVote(myVoteModel, checkedAnswers);
      } catch (e) {
        await this.ui.showToast(`Encountered error: ` + e.message, { type: 'danger' });
      }
    });
  }

  async submitVote(myVoteModel, checkedAnswers) {
    await this.storageService.insertRecordAsync(constants.TABLES.GOVERNANCE_MY_VOTES, utils.getPKFromContent(myVoteModel.uid), myVoteModel);
    // TODO: Check if other details should be provided
    await this.votingService.addVoteToSession(this.model.selectedVotingSession.enclaveSSI, {
      answers: checkedAnswers,
      voterDID: this.did
    });
    this.model = {
      isNewVotingOpened: false,
      isAddVoteOpened: false,
      isVoteResultsOpened: false,
      triggerRefreshTable: true,
      selectedVotingSession: null
    };
  }
}

export default PerformVoteController;
export { PerformVoteUI };
