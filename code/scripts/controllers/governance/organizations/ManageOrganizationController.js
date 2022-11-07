const { DwController } = WebCardinal.controllers;

class ManageOrganizationUI extends DwController {
  constructor(...props) {
    super(...props);
  }

  getInitialViewModel() {
    return {
      isVotingSelected: true,
      isMonitoringSelected: false
    };
  }
}

class ManageOrganizationController extends DwController {
  constructor(...props) {
    super(...props);

    this.ui.page = new ManageOrganizationUI(...props);
    this.model = this.ui.page.getInitialViewModel();

    this.selectedOrganization = this.model.toObject('selectedOrganization');
    console.log("organization data: ", this.selectedOrganization);

    this.attachEventListeners();
  }

  attachEventListeners() {
    this.onTagClick('organization.change.tab', (model, target, event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      const activePanelHandler = target.getAttribute('data-template-handler');
      this.model = {
        isVotingSelected: false,
        isMonitoringSelected: false
      };
      this.model[activePanelHandler] = true;
    });
  }
}

export default ManageOrganizationController;
export { ManageOrganizationUI };