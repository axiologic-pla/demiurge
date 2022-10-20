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
      this.model.notAuthorized = true;
      console.log("sharedEnclave doesn't have a defined KeySSI. " + err);
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
      console.log("Failed to get shared enclave " + e);
    }
    return sharedEnclave.getKeySSIAsync();
  }
}

export default MyIdentitiesController;
