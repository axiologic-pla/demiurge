import {DwUI} from "./DwController.js";
import {setStoredDID} from "../services/BootingIdentityService.js";
import constants from "../constants.js";

const {DwController} = WebCardinal.controllers;

export default class DwDialogWaitingApprovalController extends DwController {
  constructor(...props) {
    super(...props);

    this.showToast = new DwUI().showToast;
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
        await this.showToast(`Please insert a recovery code.`);
        return;
      }
      this.setSharedEnclaveKeySSI().then(
        () => {
          this.getSharedEnclaveKeySSI().then(
            async () => {
              this.ui.enableMenu();
              await setStoredDID(this.did, this.userDetails, constants.ACCOUNT_STATUS.CREATED);
              WebCardinal.wallet.status = constants.ACCOUNT_STATUS.CREATED;

              this.navigateToPageTag("quick-actions");
            }
          ).catch(async err => {
            this.model.notAuthorized = true;
            console.log("sharedEnclave doesn't have a defined KeySSI. " + err);
            await this.showToast(`Recovery code is not valid.`);
          })
        }
      ).catch(async err => {
        await this.showToast(`Recovery code is not valid.`);
      });
    });
  }

  async setSharedEnclaveKeySSI() {
    return new Promise((resolve, reject) => {
      const openDSU = require("opendsu");
      const scAPI = openDSU.loadAPI("sc");
      const keySSI = openDSU.loadAPI("keyssi");
      const enclaveAPI = openDSU.loadAPI("enclave");
      const recoveryCode = document.getElementById("add-member-input").value;

      try {
        keySSI.parse(recoveryCode); // parse and check if the recoveryCode has the right format for a sharedEnclaveKeySSI
      } catch (err) {
        return reject(err);
      }

      const sharedEnclave = enclaveAPI.initialiseWalletDBEnclave(recoveryCode);
      sharedEnclave.on("initialised", async () => {
        try {
          await $$.promisify(scAPI.setSharedEnclave)(sharedEnclave);
          resolve();
        } catch (e) {
          reject("Failed to set shared enclave.");
        }
      });
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
