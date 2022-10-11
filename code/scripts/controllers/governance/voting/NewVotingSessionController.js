import constants from '../../../constants.js';
import utils from '../../../utils.js';

const { DwController } = WebCardinal.controllers;

class NewVotingSessionUI {
  getInitialViewModel() {
    return {
      submitVotingType: 'opinion',
      votingType: 'Consultation / Opinion Poll'
    };
  }
}

class NewVotingSessionController extends DwController {
  constructor(...props) {
    super(...props);

    this.ui.page = new NewVotingSessionUI();
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
          // TODO: Check if is anything to fetch from shared db
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
    this.onTagClick('vote.type.opinion', () => {
      this.model.submitVotingType = 'opinion';
      this.model.votingType = 'Consultation / Opinion Poll';
    });

    this.onTagClick('vote.type.generic', () => {
      this.model.submitVotingType = 'generic';
      this.model.votingType = 'Generic Proposal';
    });

    this.onTagClick('vote.type.fixed', () => {
      this.model.submitVotingType = 'fixed';
      this.model.votingType = 'Fixed Structure Proposal';
    });

    this.onTagClick('vote.new.submit', async (model, target, event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      const modelSubmit = this.model.toObject();
      console.log(modelSubmit);
      await this.submitVotingSession(modelSubmit);
    });
  }

  async submitVotingSession(model) {
    model = {
      candidateDocumentation: undefined,
      candidateDocumentationName: undefined,
      creationDate: Date.now(),
      deadline: Date.now() + 10000,
      hasVoted: false,
      partnerDID: undefined,
      possibleResponses: ['1', '2'],
      title: 'Title of voting',
      uniqueAnswer: false,
      uid: 'dhsashalkshfaldj8a9sdasud89asd89ausd',
      votingAction: 'Voting',
      votingType: this.model.votingType,
      submitVotingType: this.model.submitVotingType
    };

    await this.sharedStorageService.insertRecordAsync(constants.TABLES.GOVERNANCE_VOTING_SESSIONS, utils.getPKFromCredential(model.deadline), model);
    this.model.votingSessions.push(model);
  }
}

export default NewVotingSessionController;
export { NewVotingSessionUI };
