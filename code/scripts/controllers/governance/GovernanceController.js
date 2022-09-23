const {DwController} = WebCardinal.controllers;

class GovernanceDashboardUI extends DwController {
  constructor(...props) {
    super(...props);
  }
}

class GovernanceController extends DwController {
  constructor(...props) {
    super(...props);
    const {ui} = this;

    ui.page = new GovernanceDashboardUI(...props);
  }
}

export default GovernanceController;
