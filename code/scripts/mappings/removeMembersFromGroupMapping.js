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
  const adminDID_Document = await $$.promisify(w3cdid.resolveDID)(adminDID.did);
  let memberDID_Document = await $$.promisify(w3cdid.resolveDID)(message.memberDID);
  const msg = {
    messageType: message.messageType
  };

  const groupDIDDocument = await $$.promisify(w3cdid.resolveDID)(message.groupDID);
  await $$.promisify(groupDIDDocument.removeMembers)([message.memberDID]);
  await $$.promisify(adminDID_Document.sendMessage)(JSON.stringify(msg), memberDID_Document);
}


require("opendsu").loadAPI("m2dsu").defineMapping(checkIfRemoveMemberFromGroupMessage, removeMemberFromGroup);
export {removeMemberFromGroup}
