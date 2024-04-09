import constants from "../constants.js";
import utils from "../utils.js";
function checkIfRemoveMemberFromGroupMessage(message) {
  return message.messageType === constants.MESSAGE_TYPES.USER_REMOVED;
}

async function removeMemberFromGroup(message) {
  const openDSU = require("opendsu");
  const w3cdid = openDSU.loadAPI("w3cdid");
  const scAPI = openDSU.loadAPI("sc");
  const apiKeyAPIs = openDSU.loadAPI("apiKey");
  const apiKeyClient = apiKeyAPIs.getAPIKeysClient();
  const mainEnclave = await $$.promisify(scAPI.getMainEnclave)();
  let adminDID = await mainEnclave.readKeyAsync(constants.IDENTITY);

  const groupDIDDocument = await $$.promisify(w3cdid.resolveDID)(message.groupDID);
  const memberDIDDocument = await $$.promisify(w3cdid.resolveDID)(message.memberDID);
  if(message.accessMode === constants.ADMIN_ACCESS_MODE) {
    await apiKeyClient.deleteAdmin(utils.getUserIdFromUsername(memberDIDDocument.getName()));
  } else {
    await apiKeyClient.deleteAPIKey(constants.APPS.DSU_FABRIC, constants.API_KEY_NAME, utils.getUserIdFromUsername(memberDIDDocument.getName()));
  }

  await $$.promisify(groupDIDDocument.removeMembers)([message.memberDID]);
  let secretsHandler = await this.getSecretsHandler(adminDID.did);
  await secretsHandler.unAuthorizeUser(message.memberDID);
}

require("opendsu").loadAPI("m2dsu").defineMapping(checkIfRemoveMemberFromGroupMessage, removeMemberFromGroup);
export {removeMemberFromGroup}
