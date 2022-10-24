const { DwController } = WebCardinal.controllers;

class DeploymentUI {
  getInitialViewModel() {
    return {
      canDisplayTemplate: true,
      templatePath: 'governance/deployment/dashboard-organization',
      templateMapper: {
        dashboardOrganization: 'governance/deployment/dashboard-organization',
        addEditOrganization: 'governance/deployment/add-edit-organization',
        viewOrganization: 'governance/deployment/view-organization',
        manageOrganization: 'governance/deployment/dashboard-network',
        addEditNetwork: 'governance/deployment/add-edit-network',
        viewNetwork: 'governance/deployment/view-network',
        manageNetwork: 'governance/deployment/manage-network'
      }
    };
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
    this.attachViewEventListeners();
  }

  attachViewEventListeners() {
    this.onTagClick('toggle.organization.dashboard', (model, target, event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      this.model.selectedOrganization = null;
      this.model.selectedNetwork = null;
      this.updateTemplate(this.model.templateMapper.dashboardOrganization);
    });

    this.onTagClick('toggle.organization.add-edit', (model, target, event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      if (target.getAttribute('data-edit') === 'edit') {
        this.model.selectedOrganization = model;
      }
      this.updateTemplate(this.model.templateMapper.addEditOrganization);
    });

    this.onTagClick('toggle.organization.view', (model, target, event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      this.model.selectedOrganization = model;
      this.updateTemplate(this.model.templateMapper.viewOrganization);
    });

    this.onTagClick('toggle.organization.manage', (model, target, event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      this.model.selectedOrganization = model;
      this.updateTemplate(this.model.templateMapper.manageOrganization);
    });

    this.onTagClick('toggle.network.add-edit', (model, target, event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      if (target.getAttribute('data-edit') === 'edit') {
        this.model.selectedNetwork = model;
      }
      this.updateTemplate(this.model.templateMapper.addEditNetwork);
    });

    this.onTagClick('toggle.network.view', (model, target, event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      this.model.selectedNetwork = model;
      this.updateTemplate(this.model.templateMapper.viewNetwork);
    });

    this.onTagClick('toggle.network.manage', (model, target, event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      this.model.selectedNetwork = model;
      this.updateTemplate(this.model.templateMapper.manageNetwork);
    });
  }

  updateTemplate(templatePath) {
    this.model.canDisplayTemplate = false;
    setTimeout(() => {
      this.model.templatePath = templatePath;
      this.model.canDisplayTemplate = true;
    }, 100);
  }
}

export default DeploymentController;
export { DeploymentUI };
