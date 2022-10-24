import constants from "../constants.js";

const {DwController} = WebCardinal.controllers;
import MessagesService from "../services/MessagesService.js";
import {getCommunicationService} from "../services/CommunicationService.js";
import utils from "../utils.js";
import {setStoredDID, getStoredDID, getWalletStatus} from "../services/BootingIdentityService.js";

class BootingIdentityController extends DwController {
  constructor(...props) {
    super(...props);
    const {ui} = this;
    ui.disableMenu();

    console.log("BootingIdentityController");

    this.model = {
      domain: this.domain,
      username: this.userDetails
    };

    let didDocument;
    getWalletStatus().then(async (walletStatus) => {
      if (walletStatus === constants.ACCOUNT_STATUS.WAITING_APPROVAL) {
        let did = await getStoredDID();
        await this.waitForApprovalDialog(ui, did)
      } else {
        this.onTagEvent("did-component", "did-generate", async (model) => {
          didDocument = model.didDocument;
          let button = model.submitElement;
          if (didDocument) {
            const did = didDocument.getIdentifier();
            await setStoredDID(did, this.model.username);
            this.did = did;
            this.domain = didDocument.getDomain();
            const openDSU = require("opendsu");
            const scAPI = openDSU.loadAPI("sc");
            const w3cDID = openDSU.loadAPI("w3cdid");
            const enclaveDB = await $$.promisify(scAPI.getMainEnclave)()
            //  ui.hideDialogFromComponent("dw-dialog-booting-identity");
            const didDomain = await $$.promisify(scAPI.getDIDDomain)();
            const publicName = "first_demiurge_identity";

            let firstDIDDocument;
            try {
              firstDIDDocument = await $$.promisify(w3cDID.resolveDID)(`did:ssi:name:${didDomain}:${publicName}`);
            } catch (e) {
              console.log("Failed to resolve DID document");
              button.loading = false;
              await ui.showDialogFromComponent(
                "dw-dialog-initialising",
                {
                  did: didDocument.getIdentifier(),
                },
                {
                  parentElement: this.element,
                  disableClosing: true,
                }
              );
              await $$.promisify(w3cDID.createIdentity)("ssi:name", didDomain, publicName);
              const data = await $$.promisify(this.DSUStorage.getObject.bind(this.DSUStorage))(
                "/app/messages/createEnclave.json"
              );
              const mainEnclave = await $$.promisify(scAPI.getMainEnclave)();
              await this.processMessages(mainEnclave, data);
              console.log("Processed create enclave messages");
              const enclaveRecord = await enclaveDB.readKeyAsync(constants.SHARED_ENCLAVE);
              await utils.addSharedEnclaveToEnv(enclaveRecord.enclaveType, enclaveRecord.enclaveDID, enclaveRecord.enclaveKeySSI);
              const messages = await $$.promisify(this.DSUStorage.getObject.bind(this.DSUStorage))(
                "/app/messages/createGroup.json"
              );
              const sharedEnclave = await $$.promisify(scAPI.getSharedEnclave)();
              const enclaves = await $$.promisify(mainEnclave.getAllRecords)(constants.TABLES.GROUP_ENCLAVES);

              for (let i = 0; i < enclaves.length; i++) {
                await sharedEnclave.writeKeyAsync(enclaves[i].enclaveName, enclaves[i]);
                await sharedEnclave.insertRecordAsync(constants.TABLES.GROUP_ENCLAVES, enclaves[i].enclaveDID, enclaves[i]);
              }

              await this.processMessages(sharedEnclave, messages);
              console.log("Processed create group messages");
              ui.enableMenu();
              let groupName = "ePI Administration Group";
              let groups = [];
              try {
                groups = await utils.promisify(sharedEnclave.filter)(constants.TABLES.GROUPS);
              } catch (e) {
                console.log(e);
              }
              let groupDID = groups.find((gr) => gr.name === groupName).did;
              const addMemberToGroupMessage = {
                messageType: "AddMemberToGroup",
                groupDID: groupDID,
                memberDID: this.did,
                memberName: this.userDetails
              };
              await this.processMessages(sharedEnclave, [addMemberToGroupMessage]);
              console.log("Processed create addMemberToGroupMessage ");

              getCommunicationService().waitForMessage(this.did, async () => {
                await setStoredDID(this.did, this.userDetails, constants.ACCOUNT_STATUS.CREATED);
                WebCardinal.wallet.status = constants.ACCOUNT_STATUS.CREATED;
                this.navigateToPageTag("quick-actions");
              })

              return;
            }

            button.loading = false;
            WebCardinal.wallet.status = constants.ACCOUNT_STATUS.WAITING_APPROVAL;
            await setStoredDID(did, this.userDetails, constants.ACCOUNT_STATUS.WAITING_APPROVAL);
            await this.waitForApprovalDialog(ui, did)

          }
        })
      }
    }).catch(async (e) => {
      await ui.showToast("Error on getting wallet status: " + e.message);
    })

  }

  async waitForApprovalDialog(ui, did) {
    getCommunicationService().waitForMessage(did, async () => {
      ui.enableMenu();
      await setStoredDID(did, this.userDetails, constants.ACCOUNT_STATUS.CREATED);

      WebCardinal.wallet.status = constants.ACCOUNT_STATUS.CREATED;
      this.navigateToPageTag("quick-actions");
    })
    await ui.showDialogFromComponent(
      "dw-dialog-waiting-approval",
      {
        did: did,
      },
      {
        parentElement: this.element,
        disableClosing: true,
      }
    );
  }

  async processMessages(storageService, messages) {
    if (!messages) {
      return
    }
    try {
      await MessagesService.processMessages(storageService, messages, (undigestedMessages) => {
        if (undigestedMessages && undigestedMessages.length > 0) {
          console.log("Couldn't process all messages. Undigested messages: ", undigestedMessages);
          return
        }
      })
    } catch (err) {
      console.log("Couldn't process messages: ", err, messages);
      return;
    }
  }
}

export default BootingIdentityController;
