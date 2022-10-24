const { DwController } = WebCardinal.controllers;

class AddEditOrganizationUI {
  getInitialViewModel() {
    return {};
  }
}

class AddEditOrganizationController extends DwController {
  constructor(...props) {
    super(...props);

    this.ui.page = new AddEditOrganizationUI();
    this.model = this.ui.page.getInitialViewModel();
  }
}

export default AddEditOrganizationController;
export { AddEditOrganizationUI };