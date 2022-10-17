import constants from '../../../constants.js';
import utils from '../../../utils.js';

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

    this.onTagClick('vote.document.download', (model, target, event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      console.log('\n\n[DOWNLOAD] Download triggered:', model);
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
        const voteSessionModel = this.model.toObject('selectedVotingSession');
        voteSessionModel.numberOfVotes = voteSessionModel.numberOfVotes + 1;
        voteSessionModel.possibleAnswers.map(answer => {
          if (checkedAnswers.includes(answer.uid)) {
            answer.count = answer.count + 1;
          }
          return answer;
        });
        await this.submitVote(myVoteModel, voteSessionModel);
      } catch (e) {
        this.ui.showToast(`Encountered error: `, e);
      }
    });
  }

  async submitVote(myVoteModel, voteSessionModel) {
    await this.storageService.insertRecordAsync(constants.TABLES.GOVERNANCE_MY_VOTES, utils.getPKFromCredential(myVoteModel.uid), myVoteModel);
    await this.sharedStorageService.updateRecordAsync(constants.TABLES.GOVERNANCE_VOTING_SESSIONS, voteSessionModel.pk, voteSessionModel);
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
