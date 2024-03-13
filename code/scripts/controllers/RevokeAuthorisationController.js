const {DwController} = WebCardinal.controllers;

class RevokeAuthorisationController extends DwController {
    constructor(...props) {
        super(...props);

        this.onTagClick("revoke-authorisation", async () => {
            //TODO: remove authorisation
            this.navigateToPageTag("integration");
        });
    }
}

export default RevokeAuthorisationController;
