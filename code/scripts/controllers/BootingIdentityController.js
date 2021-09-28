const { DwController } = WebCardinal.controllers;
import MessagesService from "../services/MessagesService.js";

class BootingIdentityController extends DwController {
  constructor(...props) {
    super(...props);
    const { ui } = this;
    ui.disableMenu();

    console.log("BootingIdentityController");

    this.model = {
      domain: this.domain,
      username: this.userDetails.username,
    };

    let didDocument;

    this.onTagEvent("did-component", "did-generate", async (readOnlyModel) => {
      didDocument = readOnlyModel.didDocument;
      await ui.showDialogFromComponent(
        "dw-dialog-booting-identity",
        {
          did: didDocument.getIdentifier(),
        },
        {
          parentElement: this.element,
        }
      );
    });

    this.onTagClick("did-confirm", async () => {
      if (didDocument) {
        const { setStoredDID } = await import("../services/BootingIdentityService.js");
        const did = didDocument.getIdentifier();
        await setStoredDID(did, this.model.username);
        this.did = did;
        this.domain = didDocument.getDomain();
        const openDSU = require("opendsu");
        const scAPI = openDSU.loadAPI("sc");
        const w3cDID = openDSU.loadAPI("w3cdid");
        ui.hideDialogFromComponent("dw-dialog-booting-identity");

        const messages = await $$.promisify(this.DSUStorage.getObject.bind(this.DSUStorage))(
          "/app/messages/createGroup.json"
        );
        if (messages) {
          const vaultDomain = await $$.promisify(scAPI.getVaultDomain)();
          let groupDIDDocument;
          debugger;
          try {
            groupDIDDocument = await $$.promisify(w3cDID.resolveDID)(
              `did:ssi:group:${vaultDomain}:${messages[0].groupName.replaceAll(" ", "_")}`
            );
          } catch (e) {}
          if (!groupDIDDocument) {
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
          } else {
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
          }
          MessagesService.processMessages(messages, async () => {
            console.log("Processed create group messages");
            const data = await $$.promisify(this.DSUStorage.getObject.bind(this.DSUStorage))(
              "/app/messages/createEnclave.json"
            );
            MessagesService.processMessages(data, () => {
              console.log("Processed create enclave messages");

              didDocument.readMessage(async (err, message) => {
                message = JSON.parse(message);
                if (message.sender === this.did) {
                  ui.enableMenu();
                  this.navigateToPageTag("quick-actions");
                  return;
                }
                const mainDSU = await $$.promisify(scAPI.getMainDSU)();
                let env = await $$.promisify(mainDSU.readFile)("/environment.json");
                env = JSON.parse(env.toString());
                env[openDSU.constants.ENCLAVE_TYPE] = message.enclave.enclaveType;
                env[openDSU.constants.ENCLAVE_DID] = message.enclave.enclaveDID;
                env[openDSU.constants.ENCLAVE_KEY_SSI] = message.enclave.enclaveKeySSI;
                await $$.promisify(mainDSU.writeFile)("/environment.json", JSON.stringify(env));
                scAPI.refreshSecurityContext();
                ui.enableMenu();
                this.navigateToPageTag("quick-actions");
              });
            });
          });
        }
      }
    });
  }
}

export default BootingIdentityController;
