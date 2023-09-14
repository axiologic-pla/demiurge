import constants from "../constants.js";

function checkIfRemoveMemberFromGroupMessage(message) {
  return message.messageType === constants.MESSAGE_TYPES.USER_REMOVED;
}

async function removeMemberFromGroup(message) {
  const openDSU = require("opendsu");
  const w3cdid = openDSU.loadAPI("w3cdid");
  const scAPI = openDSU.loadAPI("sc");
  const mainEnclave = await $$.promisify(scAPI.getMainEnclave)();
  let adminDID = await mainEnclave.readKeyAsync(constants.IDENTITY);
  const msg = {
    messageType: message.messageType
  };

  const groupDIDDocument = await $$.promisify(w3cdid.resolveDID)(message.groupDID);
  await $$.promisify(groupDIDDocument.removeMembers)([message.memberDID]);

  let secretsHandler = await this.getSecretsHandler(adminDID.did);
  await secretsHandler.unAuthorizeUser(message.memberDID);
}

require("opendsu").loadAPI("m2dsu").defineMapping(checkIfRemoveMemberFromGroupMessage, removeMemberFromGroup);
export {removeMemberFromGroup}
