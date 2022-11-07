import constants from '../../../constants.js';

const { DwController } = WebCardinal.controllers;

class ViewOrganizationUI {
  getInitialViewModel() {
    return {
      votingSessions: [],
      areVotingSessionsLoaded: false,
      hasVotingSessions: false
    };
  }
}

class ViewOrganizationController extends DwController {
  constructor(...props) {
    super(...props);

    this.ui.page = new ViewOrganizationUI();
    this.model = this.ui.page.getInitialViewModel();
    this.init();
  }

  init() {
    const waitForSharedEnclave = () => {
      console.log('Waiting for shared enclave');
      setTimeout(async () => {
        const scAPI = require('opendsu').loadAPI('sc');
        if (scAPI.sharedEnclaveExists()) {
          this.model.votingSessions = await this.fetchVotingSessions();
        } else {
          waitForSharedEnclave();
        }
      }, 100);
    };

    waitForSharedEnclave();
  }

  async fetchVotingSessions() {
    this.model.areVotingSessionsLoaded = false;
    const votingSessions = await this.sharedStorageService
      .filterAsync(constants.TABLES.GOVERNANCE_VOTING_SESSIONS, `organizationUid == ${this.model.selectedOrganization.uid}`);
    this.model.hasVotingSessions = votingSessions.length > 0;
    this.model.areVotingSessionsLoaded = true;
    return votingSessions;
  }
}

export default ViewOrganizationController;
export { ViewOrganizationUI };