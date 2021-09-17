import utils from "../utils.js";
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
}

require("opendsu").loadAPI("m2dsu").defineMapping(checkIfRemoveMemberFromGroupMessage, removeMembersFromGroup);
export  {removeMembersFromGroup}
