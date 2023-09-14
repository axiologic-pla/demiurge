const {DwController} = WebCardinal.controllers;

class LandingPageController extends DwController {
  constructor(...props) {
    super(...props);
    this.initPermissionsWatcher = () => {
      //we don't need any permissions watcher at this point in time
    };
  }
}

export default LandingPageController;
