const {DwController} = WebCardinal.controllers;
import utils from "../utils.js";
class RevokeAuthorisationController extends DwController {
    constructor(...props) {
        super(...props);

        setTimeout(async () => {
            const sorIsAuthorized = await utils.sorIsAuthorized();
            if (sorIsAuthorized) {
                this.navigateToPageTag("integration");
                return;
            }

            this.onTagClick("revoke-authorisation", async () => {
                await utils.setSorAuthorization(false);
                this.navigateToPageTag("integration");
            });
        });
    }
}

export default RevokeAuthorisationController;
