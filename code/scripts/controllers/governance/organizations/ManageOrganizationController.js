const { DwController } = WebCardinal.controllers;

class ManageOrganizationUI extends DwController {
  constructor(...props) {
    super(...props);
  }

  getInitialViewModel() {
    return {
      isMonitoringSelected: true
    };
  }
}

class ManageOrganizationController extends DwController {
  constructor(...props) {
    super(...props);

    this.ui.page = new ManageOrganizationUI(...props);
    this.model = this.ui.page.getInitialViewModel();

    this.attachEventListeners();
  }

  attachEventListeners() {
    this.onTagClick('organization.change.tab', (model, target, event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      const activePanelHandler = target.getAttribute('data-template-handler');
      this.model = {
        isMonitoringSelected: false
      };
      this.model[activePanelHandler] = true;
    });
  }
}

export default ManageOrganizationController;
export { ManageOrganizationUI };