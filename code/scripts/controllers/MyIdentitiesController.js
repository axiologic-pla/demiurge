const { DwController } = WebCardinal.controllers;

class MyIdentitiesController extends DwController {
  constructor(...props) {
    super(...props);
    const { ui } = this;

    this.model = {
      did: this.did,
      domain: this.domain,
      sharedEnclaveKeySSI: "",
      notAuthorized: false
    };

    this.getSharedEnclaveKeySSI().then( sharedEnclave => {
          if (typeof sharedEnclave === "undefined") {
            console.log("user not authorized yet");
            this.model.notAuthorized = true;
            return;
          }
          this.model.sharedEnclaveKeySSI = sharedEnclave;
        }
    ).catch(err => {
      console.log(err);
    })

    console.log(JSON.stringify(this.model, null, 1));

    this.onTagEvent("did-component", "did-generate", async (readOnlyModel) => {
      const { didDocument } = readOnlyModel;
      // console.log('# new did', { didDocument });
      console.log(didDocument.getIdentifier());
      // await ui.showToast(`New DID created: '${didDocument.getIdentifier()}'`);
    });
  }

  async getSharedEnclaveKeySSI() {
    const openDSU = require("opendsu");
    const scAPI = openDSU.loadAPI("sc");

    let sharedEnclave;
    try {
      sharedEnclave = await $$.promisify(scAPI.getSharedEnclave)();
    } catch (e) {
      throw ("Failed to get shared enclave " + err);
    }
    return sharedEnclave.getKeySSIAsync();
  }
}

export default MyIdentitiesController;
