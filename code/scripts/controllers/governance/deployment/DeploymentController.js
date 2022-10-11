const { DwController } = WebCardinal.controllers;

class DeploymentUI {
  getInitialViewModel() {
    return {};
  }
}

class DeploymentController extends DwController {
  constructor(...props) {
    super(...props);

    this.ui.page = new DeploymentUI();
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

  }
}

export default DeploymentController;
export { DeploymentUI };
