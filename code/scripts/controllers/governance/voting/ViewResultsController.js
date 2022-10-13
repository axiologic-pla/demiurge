const { DwController } = WebCardinal.controllers;

class ViewResultsUI {
  getInitialViewModel() {
    return {};
  }
}

class ViewResultsController extends DwController {
  constructor(...props) {
    super(...props);

    this.ui.page = new ViewResultsUI();
    this.model = this.ui.page.getInitialViewModel();
    this.init();
  }

  init() {
    this.attachViewEventListeners();
  }

  attachViewEventListeners() {
    this.onTagClick('history.go.back', (model, target, event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      this.model.isVoteResultsOpened = !this.model.isVoteResultsOpened;
      this.model.selectedVotingSession = null;
    });
  }
}

export default ViewResultsController;
export { ViewResultsUI };
