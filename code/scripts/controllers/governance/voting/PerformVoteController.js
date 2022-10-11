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
    this.onTagClick('vote.add.submit', (model, target, event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      console.log(this.model.toObject());
    });
  }
}

export default PerformVoteController;
export { PerformVoteUI };
