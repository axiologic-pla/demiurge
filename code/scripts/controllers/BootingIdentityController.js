const { DwController } = WebCardinal.controllers;
import MessagesService from "../services/MessagesService.js";
// import {createGroup} from "../mappings/createGroupMapping.js";
class BootingIdentityController extends DwController {
  constructor(...props) {
    super(...props);
    const { ui } = this;
    ui.disableMenu();

    console.log("BootingIdentityController");

    this.model = {
      domain: this.domain,
      username: this.userDetails.username
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

        ui.enableMenu();
        await setStoredDID(did, this.model.username);
        this.did = did;
        this.domain = didDocument.getDomain();
        const walletStorage = this.getWalletStorage();
        walletStorage.getObject("/app/messages/createGroup.json", (err, data) => {
          MessagesService.processMessages(data, () => {
            console.log("Processed messages");
          })
        });
        this.navigateToPageTag("quick-actions");
      }
    });
  }
}

export default BootingIdentityController;
