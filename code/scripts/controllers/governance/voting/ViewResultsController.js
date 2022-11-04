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
    this.initProgressBars();
  }

  attachViewEventListeners() {
    this.onTagClick('history.go.back', (model, target, event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      this.model.isVoteResultsOpened = false;
      this.model.selectedVotingSession = null;
    });

    this.onTagClick('results.document.download', async (model, target, event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      const { candidateDocumentationName, candidateDocumentationSSI } = model.selectedVotingSession;
      await this.FileManagementService.prepareDownloadFromDsu(candidateDocumentationSSI, candidateDocumentationName);
      this.FileManagementService.downloadFileToDevice();
    });
  }

  initProgressBars() {
    this.model.selectedVotingSession.possibleAnswers.map((answer) => {
      if (this.model.selectedVotingSession.numberOfVotes === 0) {
        answer.rating = `0%`;
        return answer;
      }

      answer.rating = `${answer.count * 100 / this.model.selectedVotingSession.numberOfVotes}%`;
      return answer;
    });

    setTimeout(() => {
      const progressBars = document.querySelectorAll('.progress-bar');
      for (let index = 0; index < progressBars.length; ++index) {
        const bar = progressBars[index];
        const progressRating = bar.getAttribute('data-width');
        bar.setAttribute('style', `width:${progressRating}`);
      }
    }, 100);
  }
}

export default ViewResultsController;
export { ViewResultsUI };
