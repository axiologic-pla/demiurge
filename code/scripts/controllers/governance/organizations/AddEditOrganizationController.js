import utils from '../../../utils.js';
import constants from '../../../constants.js';
import * as AdminService from '../../../services/AdminService.js';
import FileManagementService from '../../../services/FileManagementService.js';

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
        mainDomain: '',
        subDomain: '',
        dnsDomain: '',
        adminDomain: '',
        envPath: '',
        isLocalOrganization: false,
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
    this.fileManagementService = new FileManagementService();

    this.attachViewEventListeners();
    this.attachInputEventListeners();
  }

  attachInputEventListeners() {
    this.attachOrganizationNameListener();
    this.attachAdminDomainListener();
    this.attachSubDomainListener();
    this.attachMainDomainListener();
    this.attachDNSDomainListener();
    this.attachEnvironmentPathListener();
    this.attachLocalOrganizationCheckboxListener();
  }

  attachViewEventListeners() {
    this.onTagClick('history.go.back', (model, target, event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      this.goBackToOrganizationsDashboard();
    });

    this.onTagClick('download.env', (model, target, event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      const envTemplate = AdminService.getEnvironmentTemplate();
      const blob = new Blob([envTemplate], { type: 'text/plain' });
      this.fileManagementService.downloadFileToDevice({
        rawBlob: blob,
        fileName: 'environment.js'
      });
    });

    this.onTagClick('organization.submit', async (model, target, event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      try {
        const submitModel = this.model.toObject('form');
        if (this.model.isEditing) {
          await this.sharedStorageService.updateRecordAsync(constants.TABLES.GOVERNANCE_ORGANIZATIONS, submitModel.pk, submitModel);
        } else {
          await this.validateRequiredFields(submitModel);
          submitModel.createdBy = this.did;
          submitModel.createdAt = new Date().toLocaleDateString();
          if (submitModel.isLocalOrganization) {
            submitModel.baseUrl = window.location.origin;
            submitModel.dnsDomain = window.location.host;
          } else {
            submitModel.baseUrl = `https://${submitModel.dnsDomain}`;
          }
          if (submitModel.adminDomain.trim().length === 0) {
            submitModel.adminDomain = submitModel.mainDomain;
          }

          await this.registerOrganization(submitModel);
          await this.sharedStorageService.insertRecordAsync(constants.TABLES.GOVERNANCE_ORGANIZATIONS, utils.getPKFromContent(submitModel.uid), submitModel);
        }

        this.goBackToOrganizationsDashboard();
      } catch (e) {
        await this.ui.showToast(`Encountered error: ` + e.message, { type: 'danger' });
      }
    });

    this.onTagClick('organization.remove', async (model, target, event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      try {
        const submitModel = this.model.toObject('form');
        await this.sharedStorageService.deleteRecordAsync(constants.TABLES.GOVERNANCE_ORGANIZATIONS, submitModel.pk);
        this.ui.showToast(`Organization ${submitModel.name} has been removed!`, { type: 'warning' });
        this.goBackToOrganizationsDashboard();
      } catch (e) {
        this.ui.showToast(`Encountered error: ` + e.message, { type: 'danger' });
      }
    });
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

  attachOrganizationNameListener() {
    const htmlEl = document.querySelector('#organization-name');
    const handler = (event) => {
      this.model.form.name = event.target.value;
    };
    htmlEl.addEventListener('sl-change', handler);
    htmlEl.addEventListener('sl-input', handler);
  }

  attachAdminDomainListener() {
    const htmlEl = document.querySelector('#admin-domain');
    if (this.model.isEditing) {
      htmlEl.setAttribute('disabled', '');
    } else {
      const handler = (event) => {
        this.model.form.adminDomain = event.target.value;
      };
      htmlEl.addEventListener('sl-change', handler);
      htmlEl.addEventListener('sl-input', handler);
    }
  }

  attachMainDomainListener() {
    const htmlEl = document.querySelector('#main-domain');
    if (this.model.isEditing) {
      htmlEl.setAttribute('disabled', '');
    } else {
      const handler = (event) => {
        this.model.form.mainDomain = event.target.value;
      };
      htmlEl.addEventListener('sl-change', handler);
      htmlEl.addEventListener('sl-input', handler);
    }
  }

  attachSubDomainListener() {
    const htmlEl = document.querySelector('#sub-domain');
    if (this.model.isEditing) {
      htmlEl.setAttribute('disabled', '');
    } else {
      const handler = (event) => {
        this.model.form.subDomain = event.target.value;
      };
      htmlEl.addEventListener('sl-change', handler);
      htmlEl.addEventListener('sl-input', handler);
    }
  }

  attachDNSDomainListener() {
    const htmlEl = document.querySelector('#dns-domain');
    if (this.model.isEditing) {
      htmlEl.setAttribute('disabled', '');
    } else {
      const handler = (event) => {
        this.model.form.dnsDomain = event.target.value;
      };
      htmlEl.addEventListener('sl-change', handler);
      htmlEl.addEventListener('sl-input', handler);
    }
  }

  attachEnvironmentPathListener() {
    const htmlEl = document.querySelector('#environment-path');
    if (this.model.isEditing) {
      htmlEl.setAttribute('disabled', '');
    } else {
      const handler = (event) => {
        this.model.form.envPath = event.target.value;
      };
      htmlEl.addEventListener('sl-change', handler);
      htmlEl.addEventListener('sl-input', handler);
    }
  }

  attachLocalOrganizationCheckboxListener() {
    const htmlEl = document.querySelector('#local-organization');
    if (this.model.isEditing) {
      htmlEl.setAttribute('disabled', true);
      if (this.model.form.isLocalOrganization) {
        htmlEl.setAttribute('checked', true);
      }
    } else {
      const handler = (event) => {
        const isChecked = event.target.checked;
        this.model.form.isLocalOrganization = isChecked;
        if (!isChecked) {
          setTimeout(this.attachDNSDomainListener.bind(this), 0);
        }
      };
      htmlEl.addEventListener('sl-change', handler);
      htmlEl.addEventListener('sl-input', handler);
    }
  }

  async validateRequiredFields(form) {
    if (!this.isValidOrganizationName(form.name)) {
      throw new Error('Organization name is required! Maximum of 30 alphanumeric characters, including spaces, dots and dashes');
    }

    if (form.mainDomain.trim().length === 0) {
      throw new Error('Main Domain is mandatory!');
    }

    if (form.subDomain.trim().length === 0) {
      throw new Error('Subdomain is mandatory!');
    }

    if (!form.isLocalOrganization && form.dnsDomain.trim().length === 0) {
      throw new Error('DNS Domain is mandatory if the organization is not locally!');
    }

    const envDataElement = document.querySelector('#upload-env');
    if (envDataElement && envDataElement.files.length) {
      const file = envDataElement.files[0];
      form.envData = await $$.promisify(this.fileManagementService.getFileContentAsText)(file);
    }
  }

  isValidOrganizationName(organizationName) {
    return organizationName.trim().length > 0 && /^([a-z]|[A-Z]|[0-9]|\s|\.|-){1,30}$/sg.test(organizationName);
  }

  async registerOrganization(submitModel) {
    const companyVars = AdminService.getCompanyVars(submitModel);
    const { adminDomain, baseUrl, dnsDomain, envPath, envData } = submitModel;
    if (envPath && envData) {
      await AdminService.registerTemplate(baseUrl, adminDomain, envPath, envData);
    }

    await AdminService.createDomain(baseUrl, adminDomain, companyVars.subDomain);
    await AdminService.createDomain(baseUrl, adminDomain, companyVars.vaultDomain);

    for (let prop in companyVars) {
      await AdminService.storeVariable(baseUrl, adminDomain, dnsDomain, prop, companyVars[prop]);
    }
  }
}

export default AddEditOrganizationController;
export { AddEditOrganizationUI };