import constants from '../../../constants.js';
import utils from '../../../utils.js';

const { DwController } = WebCardinal.controllers;

class NewVotingSessionUI {
  getInitialViewModel() {
    return {
      submitVotingType: 'opinion',
      votingType: 'Consultation / Opinion Poll',
      hasDefaultAnswers: false,
      isFixedStructure: false,
      defaultAnswers: [{
        label: 'Yes'
      }, {
        label: 'No'
      }, {
        label: 'Abstain'
      }],
      form: {
        uid: utils.uuidv4(),
        question: '',
        possibleAnswers: [],
        numberOfVotes: 0,
        deadline: null,
        isUniqueAnswer: false,
        votingActions: {
          placeholder: 'Voting action', options: [{
            label: 'Enroll Partner', value: 'enroll-partner'
          }]
        },
        selectedVotingAction: '',
        partnerDID: '',
        candidateDocumentation: null,
        candidateDocumentationName: ''
      }
    };
  }
}

class NewVotingSessionController extends DwController {
  constructor(...props) {
    super(...props);

    this.ui.page = new NewVotingSessionUI();
    this.model = this.ui.page.getInitialViewModel();
    this.init();
  }

  init() {
    this.attachViewEventListeners();
    this.attachInputEventListeners();
  }

  attachViewEventListeners() {
    this.onTagClick('history.go.back', (model, target, event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      this.model.isNewVotingOpened = false;
    });

    this.onTagClick('vote.type.opinion', (model, target, event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      this.model.submitVotingType = 'opinion';
      this.model.votingType = 'Consultation / Opinion Poll';
      this.model.isFixedStructure = false;
      this.model.hasDefaultAnswers = false;
    });

    this.onTagClick('vote.type.generic', (model, target, event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      this.model.submitVotingType = 'generic';
      this.model.votingType = 'Generic Proposal';
      this.model.isFixedStructure = false;
      this.model.hasDefaultAnswers = true;
    });

    this.onTagClick('vote.type.fixed', (model, target, event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      this.model.submitVotingType = 'fixed';
      this.model.votingType = 'Fixed Structure Proposal';
      this.model.isFixedStructure = true;
      this.model.hasDefaultAnswers = true;
      setTimeout(() => {
        this.attachVotingActionsListener();
        this.attachDIDInputListener();
      }, 10);
    });

    this.onTagClick('vote.answer.add', (model, target, event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      const inputsPossibleAnswers = document.querySelectorAll('#possible-responses sl-input');
      for (let index = 0; index < inputsPossibleAnswers.length; ++index) {
        this.model.form.possibleAnswers[index] = { label: inputsPossibleAnswers[index].value };
      }

      this.model.form.possibleAnswers.push({ label: '' });
    });

    this.onTagClick('input.paste', async (model, target) => {
      try {
        const result = await navigator.permissions.query({
          name: 'clipboard-read'
        });
        if (result.state === 'granted' || result.state === 'prompt') {
          const clipboardValue = await navigator.clipboard.readText();
          target.parentElement.value = clipboardValue;
          return { clipboardValue };
        }
        throw Error('Coping from clipboard is not possible!');
      } catch (err) {
        target.remove();
        console.log(err);
        return '';
      }
    });

    this.onTagClick('vote.new.submit', async (model, target, event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      const modelSubmit = this.model.toObject('form');
      modelSubmit.votingType = this.model.votingType;
      modelSubmit.submitVotingType = this.model.submitVotingType;

      try {
        if (modelSubmit.question.trim().length === 0) {
          throw new Error('Question / Vote name is empty!');
        }

        if (!modelSubmit.deadline) {
          throw new Error('Deadline field is mandatory!');
        }

        const possibleAnswers = this.model.hasDefaultAnswers ? this.model.defaultAnswers.map(answer => answer.label) : [];
        const possibleAnswersInputs = document.querySelectorAll('#possible-responses sl-input');
        for (let index = 0; index < possibleAnswersInputs.length; ++index) {
          possibleAnswers.push(possibleAnswersInputs[index].value);
        }

        if (possibleAnswers.length === 0) {
          throw new Error('No answers defined');
        }

        modelSubmit.possibleAnswers = possibleAnswers.map(answer => {
          return {
            label: answer, uid: utils.uuidv4(), count: 0
          };
        });

        const documentation = document.querySelector('#upload-documentation');
        if (documentation && documentation.files.length) {
          modelSubmit.candidateDocumentation = documentation.files[0];
          modelSubmit.candidateDocumentationName = modelSubmit.candidateDocumentation.name;
        }

        await this.submitVotingSession(modelSubmit);
      } catch (e) {
        await this.ui.showToast(`Encountered error: ` + e.message, {type: 'danger'});
      }
    });
  }

  attachInputEventListeners() {
    this.attachTextareaListener();
    this.attachDeadlineListener();
    this.attachUniqueResponseListener();
  }

  attachTextareaListener() {
    const questionVoteName = document.querySelector('#question-vote-name');
    const questionVoteNameHandler = (event) => {
      this.model.form.question = event.target.value;
    };
    questionVoteName.addEventListener('sl-change', questionVoteNameHandler);
    questionVoteName.addEventListener('sl-input', questionVoteNameHandler);
  }

  attachDeadlineListener() {
    const deadline = document.querySelector('#deadline');
    const deadlineHandler = (event) => {
      this.model.form.deadline = event.target.value;
    };
    deadline.addEventListener('sl-change', deadlineHandler);
    deadline.addEventListener('sl-input', deadlineHandler);
  }

  attachUniqueResponseListener() {
    const responseType = document.querySelector('#response-type');
    const responseTypeHandler = () => {
      this.model.form.isUniqueAnswer = responseType.checked;
    };
    responseType.addEventListener('sl-change', responseTypeHandler);
  }

  attachVotingActionsListener() {
    const votingActions = document.querySelector('#voting-action');
    const votingActionsHandler = (event) => {
      const selectedValue = event.detail.item.value;
      this.model.form.selectedVotingAction = this.model.form.votingActions.options
        .find(op => op.value === selectedValue);
      this.model.form.votingActions.placeholder = this.model.form.selectedVotingAction.label;
    };
    votingActions.addEventListener('sl-select', votingActionsHandler);
  }

  attachDIDInputListener() {
    const partnerDID = document.querySelector('#partner-did');
    const partnerDIDHandler = (event) => {
      this.model.form.partnerDID = event.target.value;
    };
    partnerDID.addEventListener('sl-change', partnerDIDHandler);
    partnerDID.addEventListener('sl-input', partnerDIDHandler);
  }

  async submitVotingSession(model) {
    await this.sharedStorageService.insertRecordAsync(constants.TABLES.GOVERNANCE_VOTING_SESSIONS, utils.getPKFromCredential(utils.uuidv4()), model);
    this.model.form = this.ui.page.getInitialViewModel().form;
    this.model = {
      isNewVotingOpened: false,
      isAddVoteOpened: false,
      isVoteResultsOpened: false,
      triggerRefreshTable: true,
      selectedVotingSession: null
    };
  }
}

export default NewVotingSessionController;
export { NewVotingSessionUI };
