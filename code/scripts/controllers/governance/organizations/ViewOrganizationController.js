const { DwController } = WebCardinal.controllers;

class ViewOrganizationUI {
  getInitialViewModel() {
    return {
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
          // Fetch required data to populate the page
          // Voting sessions, members etc
        } else {
          waitForSharedEnclave();
        }
      }, 100);
    };

    waitForSharedEnclave();
  }
}

export default ViewOrganizationController;
export { ViewOrganizationUI };