const { DwController } = WebCardinal.controllers;

class GovernanceDashboardUI extends DwController {
  constructor(...props) {
    super(...props);
  }

  getInitialViewModel() {
    return {
      isCredentialsSelected: true,
      isOrganizationsSelected: false
    };
  }
}

class GovernanceController extends DwController {
  constructor(...props) {
    super(...props);

    this.ui.page = new GovernanceDashboardUI(...props);
    this.model = this.ui.page.getInitialViewModel();

    this.attachEventListeners();
  }

  attachEventListeners() {
    this.onTagClick('governance.change.tab', (model, target, event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      const activePanelHandler = target.getAttribute('data-template-handler');
      this.model = {
        isCredentialsSelected: false,
        isOrganizationsSelected: false
      };
      this.model[activePanelHandler] = true;
    });
  }
}

export default GovernanceController;
