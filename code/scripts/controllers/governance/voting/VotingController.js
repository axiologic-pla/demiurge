import constants from '../../../constants.js';

const { DwController } = WebCardinal.controllers;

class VotingUI {
  getInitialViewModel() {
    return {
      votingSessions: [],
      hasVotingSessions: false,
      areVotingSessionsLoaded: false,
      isNewVotingOpened: false
    };
  }
}

class VotingController extends DwController {
  constructor(...props) {
    super(...props);

    this.ui.page = new VotingUI();
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
          this.model.votingSessions = await this.fetchVotingSessions();
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
    this.onTagClick('toggle.voting.new', () => {
      this.model.isNewVotingOpened = !this.model.isNewVotingOpened;
    });

    this.onTagClick('toggle.voting.add', () => {
      this.model.isAddVoteOpened = !this.model.isAddVoteOpened;
    });
  }

  async fetchVotingSessions() {
    this.model.areVotingSessionsLoaded = false;
    let votingSessions = await this.sharedStorageService.filterAsync(constants.TABLES.GOVERNANCE_VOTING_SESSIONS);
    // Prepare options according to status, due date etc...
    votingSessions = votingSessions.map(vote => {
      vote.options = [{
        eventTag: 'toggle.voting.add',
        label: 'Add Vote'
      }];
      return vote;
    });

    this.model.hasVotingSessions = votingSessions.length > 0;
    this.model.areVotingSessionsLoaded = true;
    return votingSessions;
  }
}

export default VotingController;
export { VotingUI };
