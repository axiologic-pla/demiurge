const { DwController } = WebCardinal.controllers;

class MyIdentitiesController extends DwController {
  constructor(...props) {
    super(...props);

    console.log({ identity: this.identity });

    this.model = {
      did: this.identity.did,
      domain: this.identity.domain
    };
  }
}

export default MyIdentitiesController;
