import utils from "../utils.js";
import constants from "../constants.js";

function CommunicationService() {
  this.waitForMessage = (did, callback) => {
    const openDSU = require("opendsu");
    const keySSISpace = openDSU.loadAPI("w3cdid");
    const __waitForMessage = () => {
      did.subscribe(async (err, message) => {
        message = JSON.parse(message);
        if (message.sender !== did.getIdentifier()) {
          if (message.messageType === "UserLogin") {
            await utils.addLogMessage(message.userDID, constants.OPERATIONS.LOGIN, "ePI Write Group", "-", message.messageId);
            return callback();
          }
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
