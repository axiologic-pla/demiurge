import {createGroup} from "../mappings/createGroupMapping.js";
import {deleteGroup} from "../mappings/deleteGroupMapping.js";
import {addMemberToGroupMapping} from "../mappings/addMemberToGroupMapping.js";
import {createEnclave} from "../mappings/createEnclaveMapping.js";
import {getMessageQueuingServiceInstance} from "./MessageQueuingService.js";

async function processMessages(storageService, messages, callback) {
    const openDSU = require("opendsu");
    const scAPI = openDSU.loadAPI("sc");
    if (typeof messages === "function") {
        callback = messages;
        messages = storageService;
        storageService = await $$.promisify(scAPI.getMainEnclave)();
    }
    if (!messages || messages.length === 0) {
        return;
    }
    const m2dsu = openDSU.loadAPI("m2dsu");
    const MessagesPipe = m2dsu.getMessagesPipe();
    let mappingEngine = m2dsu.getMappingEngine(storageService);

    return new Promise(function (resolve, reject) {
        try {
            const MessageQueuingService = getMessageQueuingServiceInstance();
            let messagesPipe = new MessagesPipe(30, 2 * 1000, MessageQueuingService.getNextMessagesBlock);
            let digestedMessagesCounter = 0;
            let undigestedMessages = [];
            messagesPipe.onNewGroup(async (groupMessages) => {
                undigestedMessages = [...undigestedMessages, ...await mappingEngine.digestMessages(groupMessages)];
                digestedMessagesCounter += groupMessages.length;
                if (digestedMessagesCounter >= messages.length) {
                    console.log("undigested messages ", undigestedMessages);
                    resolve(callback(undigestedMessages));
                }
            })

            messagesPipe.addInQueue(messages);

        } catch (err) {
            console.log("Error on digestMessages", err);
            reject(err)
        }
    });
}

export default {
    processMessages
}
