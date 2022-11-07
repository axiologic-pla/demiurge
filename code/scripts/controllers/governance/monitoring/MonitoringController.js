const { DwController } = WebCardinal.controllers;

class MonitoringUI extends DwController {
  constructor(...props) {
    super(...props);
  }

  getInitialViewModel() {
    return {};
  }
}

class MonitoringController extends DwController {
  constructor(...props) {
    super(...props);

    this.ui.page = new MonitoringUI(...props);
    this.model = this.ui.page.getInitialViewModel();

    this.selectedOrganization = this.model.toObject('selectedOrganization');
    console.log("organization data: ", this.selectedOrganization);
  }
}

export default MonitoringController;
export { MonitoringUI };