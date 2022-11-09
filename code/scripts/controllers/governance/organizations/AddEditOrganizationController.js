import utils from '../../../utils.js';
import constants from '../../../constants.js';

const { DwController } = WebCardinal.controllers;

class AddEditOrganizationUI {
  getInitialViewModel(fromModel) {
    if (fromModel) {
      return {
        title: 'Edit Organization',
        submitButtonLabel: 'Update Organization',
        isEditing: true,
        previousOrganizationName: fromModel.name,
        form: JSON.parse(JSON.stringify(fromModel))
      };
    }

    return {
      title: 'Define New Organization',
      submitButtonLabel: 'Create Organization',
      isEditing: false,
      form: {
        name: '',
        uid: utils.uuidv4()
      }
    };
  }
}

class AddEditOrganizationController extends DwController {
  constructor(...props) {
    super(...props);

    this.ui.page = new AddEditOrganizationUI();
    this.model = this.ui.page.getInitialViewModel(this.model.selectedOrganization);
    this.init();
  }

  init() {
    this.attachViewEventListeners();
    this.attachInputEventListeners();
  }

  attachInputEventListeners() {
    this.attachOrganizationNameListener();
  }

  attachViewEventListeners() {
    this.onTagClick('history.go.back', (model, target, event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      this.goBackToOrganizationsDashboard();
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

    this.onTagClick('organization.submit', async (model, target, event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      try {
        if (!this.isValidOrganizationName()) {
          throw new Error('Organization name is required! Maximum of 30 alphanumeric characters, including spaces, dots and dashes');
        }

        const submitModel = this.model.toObject('form');
        if (this.model.isEditing) {
          await this.sharedStorageService.updateRecordAsync(constants.TABLES.GOVERNANCE_ORGANIZATIONS, submitModel.pk, submitModel);
        } else {
          submitModel.createdBy = this.did;
          submitModel.votingSessions = [];
          submitModel.members = [];
          submitModel.createdAt = new Date().toLocaleDateString();
          await this.sharedStorageService.insertRecordAsync(constants.TABLES.GOVERNANCE_ORGANIZATIONS, utils.getPKFromContent(submitModel.uid), submitModel);
        }

        this.goBackToOrganizationsDashboard();
      } catch (e) {
        await this.ui.showToast(`Encountered error: ` + e.message, {type: 'danger'});
      }
    });

    this.onTagClick('organization.remove', async (model, target, event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      try {
        const submitModel = this.model.toObject('form');
        await this.sharedStorageService.deleteRecordAsync(constants.TABLES.GOVERNANCE_ORGANIZATIONS, submitModel.pk);
        this.ui.showToast(`Organization ${submitModel.name} has been removed!`, {type: 'warning'});
        this.goBackToOrganizationsDashboard();
      } catch (e) {
        this.ui.showToast(`Encountered error: ` + e.message, {type: 'danger'});
      }
    });
  }

  isValidOrganizationName() {
    const organizationName = this.model.form.name;
    return organizationName.trim().length > 0 && /^([a-z]|[A-Z]|[0-9]|\s|\.|-){1,30}$/sg.test(organizationName);
  }

  attachOrganizationNameListener() {
    const organizationName = document.querySelector('#organization-name');
    const organizationNameHandler = (event) => {
      this.model.form.name = event.target.value;
    };
    organizationName.addEventListener('sl-change', organizationNameHandler);
    organizationName.addEventListener('sl-input', organizationNameHandler);
  }

  goBackToOrganizationsDashboard() {
    this.model.selectedOrganization = null;
    this.model.selectedNetwork = null;
    this.updateTemplate(this.model.templateMapper.dashboardOrganization);
  }

  updateTemplate(templatePath) {
    this.model.canDisplayTemplate = false;
    setTimeout(() => {
      this.model.templatePath = templatePath;
      this.model.canDisplayTemplate = true;
    }, 100);
  }
}

export default AddEditOrganizationController;
export { AddEditOrganizationUI };