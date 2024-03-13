const {DwController} = WebCardinal.controllers;

class IntegrationController extends DwController {
    constructor(...props) {
        super(...props);
        const {ui} = this;

        this.model = {
            "app-id-input": "",
            "scope-input": "",
            "secret-input": ""
        };

        this.onTagClick("authorize", async () => {
            if (!this.model["app-id-input"] || !this.model["scope-input"] || !this.model["secret-input"]) {
                this.notificationHandler.reportUserRelevantError("All inputs are required!!!")
                return;
            }
            //TODO authorisation flow
            this.navigateToPageTag("revoke-authorisation");
        });

    }


}

export default IntegrationController;
