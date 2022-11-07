const { DwController } = WebCardinal.controllers;

class OrganizationsUI {
  getInitialViewModel() {
    return {
      canDisplayTemplate: true,
      templatePath: 'governance/organizations/dashboard-organization',
      templateMapper: {
        dashboardOrganization: 'governance/organizations/dashboard-organization',
        addEditOrganization: 'governance/organizations/add-edit-organization',
        viewOrganization: 'governance/organizations/view-organization',
        manageOrganization: 'governance/organizations/manage-organization'
      }
    };
  }
}

class OrganizationsController extends DwController {
  constructor(...props) {
    super(...props);

    this.ui.page = new OrganizationsUI();
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
      this.updateTemplate(this.model.templateMapper.dashboardOrganization);
    });

    this.onTagClick('toggle.organization.add-edit', (model, target, event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      if (target.getAttribute('data-edit') === 'edit') {
        this.model.selectedOrganization = model;
      } else {
        this.model.selectedOrganization = null;
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
  }

  updateTemplate(templatePath) {
    this.model.canDisplayTemplate = false;
    setTimeout(() => {
      this.model.templatePath = templatePath;
      this.model.canDisplayTemplate = true;
    }, 100);
  }
}

export default OrganizationsController;
export { OrganizationsUI };
