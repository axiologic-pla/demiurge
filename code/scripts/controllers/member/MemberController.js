const { DwController } = WebCardinal.controllers;

class MemberController extends DwController {
  constructor(...props) {
    super(...props);
    const { selectedGroup, selectedMember } = this.getStateSelection();

    if (!selectedGroup || !selectedMember) {
      this.history.goBack();
      return;
    }

    this.model = {selectedGroup, selectedMember};
    this.setStateSelection();
  }

  getStateSelection() {
    // TODO: getState() uses location history of @stencil/router (v1) in WebCardinal implementation
    // which seems to work inappropriate in an iframe when native History API (pushState) is used
    try {
      return JSON.parse(window.history.state);
    } catch (err) {
      this.notificationHandler.reportDevRelevantInfo("Failed to parse history satate", err);
      return {};
    }
  }

  setStateSelection() {
    this.updateState("selectedGroup", this.model.selectedGroup);
    this.updateState("selectedMember", this.model.selectedMember);
  }
}

export default MemberController;
