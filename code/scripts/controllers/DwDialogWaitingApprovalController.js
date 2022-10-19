const {DwController} = WebCardinal.controllers;

export default class DwDialogWaitingApprovalController extends DwController {
    constructor(...props) {
        super(...props);

        this.tagClickListeners();
    }

    tagClickListeners() {
        this.onTagClick("paste-from-clipboard", () => {
            navigator.clipboard.readText()
                .then((clipText) => (document.getElementById("add-member-input").value = clipText))
                .catch(err => console.log(err));
        });
        this.onTagClick("continue", async () => {
            if (document.getElementById("add-member-input").value === "") {
                return;
            }
            this.setSharedEnclaveKeySSI().then().catch(err => {
                console.log(err);
            });

            this.ui.enableMenu();
            this.navigateToPageTag("quick-actions");
        });
    }

    async setSharedEnclaveKeySSI() {
        const openDSU = require("opendsu");
        const scAPI = openDSU.loadAPI("sc");
        const enclaveAPI = openDSU.loadAPI("enclave");
        const recoveryCode = document.getElementById("add-member-input").value;

        const sharedEnclave = enclaveAPI.initialiseWalletDBEnclave(recoveryCode);
        sharedEnclave.on("initialised", async () => {
            try {
                await $$.promisify(scAPI.setSharedEnclave)(sharedEnclave);
            } catch (e) {
                throw ("Failed to set shared enclave " + e);
            }
        });
    }
}
