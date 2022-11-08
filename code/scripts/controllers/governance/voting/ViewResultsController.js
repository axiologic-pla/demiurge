import { getVotingServiceInstance } from '../../../services/VotingService.js';
import FileManagementService from '../../../services/FileManagementService.js';

const { DwController } = WebCardinal.controllers;

class ViewResultsController extends DwController {
  constructor(...props) {
    super(...props);

    this.init();
  }

  init() {
    this.votingService = getVotingServiceInstance();
    this.fileManagementService = new FileManagementService();

    this.initVotingResultsModel();
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
      await this.fileManagementService.prepareDownloadFromDsu(candidateDocumentationSSI, candidateDocumentationName);
      this.fileManagementService.downloadFileToDevice();
    });
  }

  initProgressBars() {
    const selectedSession = this.model.toObject('selectedVotingSession');
    this.model.selectedVotingSession.voteResults = [];
    const votesCount = selectedSession.votes.length;
    let allResults = selectedSession.votes.map(vote => vote.answers);
    allResults = [].concat(...allResults);
    selectedSession.possibleAnswers.forEach((answer) => {
      let rating = '0%';
      const votesNumber = allResults.filter(r => r === answer.uid).length;
      if (votesNumber > 0) {
        rating = `${votesNumber * 100 / votesCount}%`;
      }

      this.model.selectedVotingSession.voteResults.push({
        uid: answer.uid,
        label: answer.label,
        rating
      });
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

  initVotingResultsModel() {
  }
}

export default ViewResultsController;
