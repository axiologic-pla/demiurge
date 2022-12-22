import constants from '../../../constants.js';

const { DwController } = WebCardinal.controllers;

class DashboardOrganizationUI {
  getInitialViewModel() {
    return {
      organizations: [],
      areOrganizationsLoaded: false,
      hasOrganizations: false
    };
  }
}

class DashboardOrganizationController extends DwController {
  constructor(...props) {
    super(...props);

    this.ui.page = new DashboardOrganizationUI();
    this.model = this.ui.page.getInitialViewModel();
    this.init();
  }

  init() {
    const waitForSharedEnclave = () => {
      console.log('Waiting for shared enclave');
      setTimeout(async () => {
        const scAPI = require('opendsu').loadAPI('sc');
        if (scAPI.sharedEnclaveExists()) {
          await this.fetchOrganizations();
        } else {
          waitForSharedEnclave();
        }
      }, 100);
    };

    waitForSharedEnclave();
  }

  async fetchOrganizations() {
    this.model.areOrganizationsLoaded = false;
    this.model.organizations = await this.sharedStorageService.filterAsync(constants.TABLES.GOVERNANCE_ORGANIZATIONS);

    this.model.hasOrganizations = this.model.organizations.length > 0;
    if (!this.model.hasOrganizations) {
      this.model.areOrganizationsLoaded = true;
      return;
    }

    this.model.areOrganizationsLoaded = true;
  }
}

export default DashboardOrganizationController;
export { DashboardOrganizationUI };
