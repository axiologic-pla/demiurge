const { DwController } = WebCardinal.controllers;

class MyIdentitiesController extends DwController {
  constructor(...props) {
    super(...props);

    this.model = {
      did: this.identity.did,
    };
  }
}

export default MyIdentitiesController;
