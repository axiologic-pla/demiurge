const { DwController } = WebCardinal.controllers;

class MyIdentitiesController extends DwController {
  constructor(...props) {
    super(...props);
    this.model = {
      did: this.did,
      domain: this.domain,
      sharedEnclaveKeySSI: "",
      notAuthorized: false
    };


    this.onTagEvent("did-component", "did-generate", async (readOnlyModel) => {
      const { didDocument } = readOnlyModel;
      // console.log('# new did', { didDocument });
      console.log(didDocument.getIdentifier());
      // await ui.showToast(`New DID created: '${didDocument.getIdentifier()}'`);
    });
  }


}

export default MyIdentitiesController;
