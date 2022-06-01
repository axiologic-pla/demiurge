import utils from "../utils.js";

function CommunicationService() {
    this.waitForMessage = (did, callback) => {
        const openDSU = require("opendsu");
        const keySSISpace = openDSU.loadAPI("w3cdid");
        const __waitForMessage = () => {
            did.readMessage(async (err, message) => {
                message = JSON.parse(message);
                if (message.sender !== did.getIdentifier()) {
                    await utils.addSharedEnclaveToEnv(message.enclave.enclaveType, message.enclave.enclaveDID, message.enclave.enclaveKeySSI);
                    callback();
                } else {
                    callback();
                }
            });
        }
        if (typeof did === "string") {
            keySSISpace.resolveDID(did, (err, didDocument) => {
                if (err) {
                    return callback(err);
                }

                did = didDocument
                __waitForMessage();
            })
        } else {
            __waitForMessage()
        }
    };
}

const getCommunicationService = () => {
    if (!$$.communicationService) {
        $$.communicationService = new CommunicationService();
    }

    return $$.communicationService;
};

export {getCommunicationService};
