import utils from "../utils.js";
import constants from "../constants.js";

const promisify = utils.promisify;

function checkIfRemoveMemberFromGroupMessage(message) {
  return message.messageType === "RemoveMembersFromGroup";
}

async function removeMembersFromGroup(message) {
  const openDSU = require("opendsu");
  const w3cdid = openDSU.loadAPI("w3cdid");
  const scAPI = openDSU.loadAPI("sc");
  const vaultDomain = await promisify(scAPI.getVaultDomain)();
  const dsu = await this.createDSU(vaultDomain, "seed")
  const groupDIDDocument = await promisify(w3cdid.resolveDID)(message.groupDID);
  await promisify(groupDIDDocument.removeMembers)(message.memberDIDs);
  const mainEnclave = await $$.promisify(scAPI.getMainEnclave)();
  let adminDID = await mainEnclave.readKeyAsync(constants.IDENTITY);
  const adminDID_Document = await $$.promisify(w3cdid.resolveDID)(adminDID.did);
  for (let i = 0; i < message.memberDIDs.length; i++) {
    let memberDID_Document = await $$.promisify(w3cdid.resolveDID)(message.memberDIDs[i].did);
    const msg = {
      messageType: message.messageType
    };
    await $$.promisify(adminDID_Document.sendMessage)(JSON.stringify(msg), memberDID_Document);
  }

}

require("opendsu").loadAPI("m2dsu").defineMapping(checkIfRemoveMemberFromGroupMessage, removeMembersFromGroup);
export {removeMembersFromGroup}
