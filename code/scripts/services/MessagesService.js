import {createGroup} from "../mappings/createGroupMapping.js";
import {deleteGroup} from "../mappings/deleteGroupMapping.js";
import {addMemberToGroupMapping} from "../mappings/addMemberToGroupMapping.js";
import {createEnclave} from "../mappings/createEnclaveMapping.js";
import {removeMembersFromGroup} from "../mappings/removeMembersFromGroupMapping.js";
import {deactivateMember} from "../mappings/deactivateMemberMapping.js";
import {getMessageQueuingServiceInstance} from "./MessageQueuingService.js";
import utils from "../utils.js";

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
          let digestedMessages = messages;
          for (let i = 0; i < undigestedMessages.length; i++) {
            if (undigestedMessages[i].auditData) {
              await utils.addLogMessage( undigestedMessages[i].auditData.userDID, "Failed " + undigestedMessages[i].auditData.action, undigestedMessages[i].auditData.userGroup);
              let index = messages.findIndex(msg => JSON.stringify(msg) === JSON.stringify(undigestedMessages[i]));
              digestedMessages.splice(index, 1);
            }
          }

          for (let i = 0; i < digestedMessages.length; i++) {
            if (digestedMessages[i].auditData) {
              await utils.addLogMessage( digestedMessages[i].auditData.userDID, digestedMessages[i].auditData.action, digestedMessages[i].auditData.userGroup);
            }
          }
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
