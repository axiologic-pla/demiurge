const { DwController } = WebCardinal.controllers;

class MyIdentitiesController extends DwController {
  constructor(...props) {
    super(...props);

    this.model = {
      did: this.did,
      domain: this.domain,
    };

    console.log();

    this.onTagEvent("did-component", "did-generate", async (readOnlyModel) => {
      const { didDocument } = readOnlyModel;
      console.log('# new did', { didDocument });
      console.log(didDocument.getIdentifier());
    });
  }
}

export default MyIdentitiesController;
