const { DwController } = WebCardinal.controllers;

class MyIdentitiesController extends DwController {
  constructor(...props) {
    super(...props);

    console.log({ identity: this.identity });

    this.model = {
      did: this.identity.did,
      domain: this.identity.domain,
    };

    this.onTagEvent("did-component", "did-generate", async (readOnlyModel) => {
      const { didDocument } = readOnlyModel;
      console.log({ didDocument });
      console.log(didDocument.getIdentifier());
    });
  }
}

export default MyIdentitiesController;
