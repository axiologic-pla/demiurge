import constants from '../../../constants.js';

const { DwController } = WebCardinal.controllers;

class VotingUI {
  getInitialViewModel() {
    return {
      votingSessions: [],
      hasVotingSessions: false,
      areVotingSessionsLoaded: false,
      isNewVotingOpened: false,
      isVoteResultsOpened: false,
      selectedVotingSession: ''
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

    this.onTagClick('toggle.voting.add', (model) => {
      this.model.isAddVoteOpened = !this.model.isAddVoteOpened;
      this.model.selectedVotingSession = model;
    });

    this.onTagClick('toggle.voting.results', (model) => {
      this.model.isVoteResultsOpened = !this.model.isVoteResultsOpened;
      this.model.selectedVotingSession = model;
    });
  }

  async fetchVotingSessions() {
    this.model.areVotingSessionsLoaded = false;
    let myVotes = await this.storageService.filterAsync(constants.TABLES.GOVERNANCE_MY_VOTES);
    let votingSessions = await this.sharedStorageService.filterAsync(constants.TABLES.GOVERNANCE_VOTING_SESSIONS);
    // Prepare options according to status, due date etc...
    votingSessions = votingSessions.map(vote => {
      const hasVoted = myVotes.filter(v => v.uid === vote.uid)?.length > 0;
      const isConcluded = Date.now() > new Date(vote.deadline).getTime();

      vote.canVote = hasVoted ? 'false' : (isConcluded ? '' : 'true');
      vote.status = hasVoted ? 'Voted' : (isConcluded ? 'Ended' : 'In progress');
      vote.concluded = isConcluded ? 'true' : '';
      vote.overallStatus = isConcluded ? 'Concluded' : 'In progress';
      vote.options = isConcluded ? 'View results' : '';
      vote.hasVoted = hasVoted;
      vote.isConcluded = isConcluded;

      vote.options = [];
      if (!hasVoted && !isConcluded) {
        vote.options.push({
          eventTag: 'toggle.voting.add',
          optionLabel: 'Add vote'
        });
      }
      if (isConcluded) {
        vote.options.push({
          eventTag: 'toggle.voting.results',
          optionLabel: 'View results'
        });
      }

      return vote;
    });

    this.model.hasVotingSessions = votingSessions.length > 0;
    this.model.areVotingSessionsLoaded = true;
    return votingSessions;
  }
}

export default VotingController;
export { VotingUI };
