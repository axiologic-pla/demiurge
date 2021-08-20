const { DwController } = WebCardinal.controllers;

class BootingIdentityController extends DwController {
  constructor(...props) {
    super(...props);

    console.log("BootingIdentityController");

    this.model = {
      domain: this.domain,
    };
  }
}

export default BootingIdentityController;
