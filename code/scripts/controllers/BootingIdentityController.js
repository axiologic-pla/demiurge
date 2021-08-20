const { DwController } = WebCardinal.controllers;

class BootingIdentityController extends DwController {
  constructor(...props) {
    super(...props);
    const { ui } = this;
    ui.disableMenu();

    console.log("BootingIdentityController");

    this.model = {
      domain: this.domain,
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
        ui.enableMenu();
        this.did = didDocument.getIdentifier();
        this.domain = didDocument.getDomain();
        this.navigateToPageTag("my-identities");
      }
    });
  }
}

export default BootingIdentityController;
