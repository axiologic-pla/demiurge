import constants from '../../../constants.js';

const { DwController } = WebCardinal.controllers;

class DashboardNetworkUI {
  getInitialViewModel() {
    return {
      networks: [],
      areNetworksLoaded: false,
      hasNetworks: false
    };
  }
}

class DashboardNetworkController extends DwController {
  constructor(...props) {
    super(...props);

    this.ui.page = new DashboardNetworkUI();
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
          this.model.networks = await this.fetchNetworks();
          console.log('Model: ', this.model.toObject());
        } else {
          waitForSharedEnclave();
        }
      }, 100);
    };

    waitForSharedEnclave();
  }

  async fetchNetworks() {
    this.model.areNetworksLoaded = false;
    const networks = await this.sharedStorageService
      .filterAsync(constants.TABLES.GOVERNANCE_NETWORKS, `organizationUid == ${this.model.selectedOrganization.uid}`);
    this.model.hasNetworks = networks.length > 0;
    this.model.areNetworksLoaded = true;
    return networks;
  }
}

export default DashboardNetworkController;
export { DashboardNetworkUI };
