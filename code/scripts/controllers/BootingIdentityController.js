import constants from "../constants.js";

const {DwController} = WebCardinal.controllers;
import MessagesService from "../services/MessagesService.js";
import {getCommunicationService} from "../services/CommunicationService.js";
import utils from "../utils.js";

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

    this.onTagEvent("did-component", "did-generate", async (model) => {
      didDocument = model.didDocument;
      let button = model.submitElement;
      if (didDocument) {
        const {setStoredDID} = await import("../services/BootingIdentityService.js");
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
          let groups = [];
          try {
            groups = await utils.promisify(sharedEnclave.filter)(constants.TABLES.GROUPS);
          } catch (e) {
            console.log(e);
          }

          let adminGroup = groups.find((gr) => gr.accessMode === constants.ADMIN_ACCESS_MODE) || {};
          this.groupName = adminGroup.name;
          const addMemberToGroupMessage = {
            messageType: "AddMemberToGroup",
            groupDID: adminGroup.did,
            enclaveName: adminGroup.enclaveName,
            memberDID: this.did,
            memberName: this.userDetails
          };
          await this.processMessages(sharedEnclave, [addMemberToGroupMessage]);
          console.log("Processed create addMemberToGroupMessage ");
          getCommunicationService().waitForMessage(this.did, async () => {
            this.navigateToPageTag("quick-actions");
          });

          return;
        }

        button.loading = false;

        await ui.showDialogFromComponent(
          "dw-dialog-waiting-approval",
          {
            did: didDocument.getIdentifier(),
          },
          {
            parentElement: this.element,
            disableClosing: true,
          }
        );
        getCommunicationService().waitForMessage(this.did, async () => {
          ui.enableMenu();
          this.navigateToPageTag("quick-actions");
        })
      }
      /*      button.loading = false;
            await ui.showDialogFromComponent(
              "dw-dialog-booting-identity",
              {
                did: didDocument.getIdentifier(),
              },
              {
                parentElement: this.element,
              }
            );*/
    });

    /*    this.onTagClick("did-confirm", async (model, button) => {
          button.loading = true;
          if (didDocument) {
            const { setStoredDID } = await import("../services/BootingIdentityService.js");
            const did = didDocument.getIdentifier();
            await setStoredDID(did, this.model.username);
            this.did = did;
            this.domain = didDocument.getDomain();
            const openDSU = require("opendsu");
            const scAPI = openDSU.loadAPI("sc");
            const w3cDID = openDSU.loadAPI("w3cdid");
            const enclaveDB = await $$.promisify(scAPI.getMainEnclave)()
            ui.hideDialogFromComponent("dw-dialog-booting-identity");
            const didDomain = await $$.promisify(scAPI.getDIDDomain)();
            const publicName = "first_demiurge_identity";

            let firstDIDDocument;
            try {
              firstDIDDocument = await $$.promisify(w3cDID.resolveDID)(`did:ssi:name:${didDomain}:${publicName}`);
            }catch (e) {
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
              this.processMessages(mainEnclave, data, async ()=>{
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
                this.processMessages(sharedEnclave, messages, async () => {
                  console.log("Processed create group messages");
                  getCommunicationService().waitForMessage(this.did, ()=>{
                    ui.enableMenu();
                    this.navigateToPageTag("quick-actions");
                  })              });
              })
              return;
            }

            button.loading = false;
            await ui.showDialogFromComponent(
                "dw-dialog-waiting-approval",
                {
                  did: didDocument.getIdentifier(),
                },
                {
                  parentElement: this.element,
                  disableClosing: true,
                }
            );
            getCommunicationService().waitForMessage(this.did, ()=>{
              ui.enableMenu();
              this.navigateToPageTag("quick-actions");
            })      }
        });*/
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
