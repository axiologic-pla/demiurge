import constants from "../constants.js";
import utils from "../utils.js";

const {DwController} = WebCardinal.controllers;

class IntegrationController extends DwController {
    constructor(...props) {
        super(...props);
        window.WebCardinal.loader.hidden = false;
        this.model = {
            "app-id-input": "",
            "scope-input": "",
            "secret-input": "",
            "token-endpoint-input": ""
        };
        let self = this;
        setTimeout(async () => {
            let sorUserId = await utils.getSorUserId();
            if (sorUserId && sorUserId !== "") {
                self.element.querySelector("#revoke-inputs-container").classList.toggle("hidden");
            } else {
                self.element.querySelector("#authorize-inputs-container").classList.toggle("hidden");
            }
            const openDSU = require("opendsu");
            const crypto = openDSU.loadAPI("crypto");
            const apiKeyAPI = openDSU.loadAPI("apiKey");
            const apiKeyClient = apiKeyAPI.getAPIKeysClient();
            window.WebCardinal.loader.hidden = true;
            this.onTagClick("authorize", async () => {
                if (!this.model["app-id-input"] || !this.model["scope-input"] || !this.model["secret-input"] || !this.model["token-endpoint-input"]) {
                    this.notificationHandler.reportUserRelevantError("All inputs are required!!!")
                    return;
                }
                //TODO authorisation flow
                const clientId = this.model["app-id-input"];
                const scope = this.model["scope-input"];
                const clientSecret = this.model["secret-input"];
                const tokenEndpoint = this.model["token-endpoint-input"];

                const body = {
                    clientSecret,
                    clientId,
                    scope,
                    tokenEndpoint
                }

                let response;
                try {
                    response = await fetch("/clientAuthenticationProxy/getUserId", {
                        method: 'POST',
                        headers: {
                            'Cookie': localStorage.getItem("accessTokenCookie"),
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(body)
                    })
                } catch (e) {
                    console.log(e)
                    this.notificationHandler.reportUserRelevantError("Failed to authorize the application");
                    return;
                }
                if (response.status !== 200) {
                    this.notificationHandler.reportUserRelevantError("Failed to authorize the application");
                    return;
                }
                const userId = await response.text();
                const apiKey = {
                    secret: crypto.sha256JOSE(crypto.generateRandom(32), "base64"),
                    scope: constants.WRITE_ACCESS_MODE
                }
                try {
                    await apiKeyClient.associateAPIKey(constants.APPS.DSU_FABRIC, constants.API_KEY_NAME, userId, JSON.stringify(apiKey));
                    await utils.setSorUserId(userId);
                } catch (e) {
                    console.log(e)
                    this.notificationHandler.reportUserRelevantError("Failed to authorize the application");
                    return;
                }
                await utils.addLogMessage(this.did, constants.OPERATIONS.AUTHORIZE, this.groupName);
                self.element.querySelector("#revoke-inputs-container").classList.toggle("hidden");
                self.element.querySelector("#authorize-inputs-container").classList.toggle("hidden");
            });
            this.onTagClick("revoke-authorisation", async () => {
                const sorUserId = await utils.getSorUserId();
                try {
                    await apiKeyClient.deleteAPIKey(constants.APPS.DSU_FABRIC, constants.API_KEY_NAME, sorUserId);
                } catch (e) {
                    console.log(e)
                    this.notificationHandler.reportUserRelevantError("Failed to revoke the authorisation");
                    return;
                }
                await utils.setSorUserId("");
                await utils.addLogMessage(this.did, constants.OPERATIONS.REVOKE, this.groupName);
                self.element.querySelector("#revoke-inputs-container").classList.toggle("hidden");
                self.element.querySelector("#authorize-inputs-container").classList.toggle("hidden");
                this.model = {
                    "app-id-input": "",
                    "scope-input": "",
                    "secret-input": "",
                    "token-endpoint-input": ""
                };
            });
        });
    }

}

export default IntegrationController;
