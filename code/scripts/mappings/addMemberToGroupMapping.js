import constants from "../constants.js";
import utils from "../utils.js";
const promisify = utils.promisify;

function checkIfAddMemberToGroupMessage(message) {
    return message.messageType === "AddMemberToGroup";
}

async function addMemberToGroupMapping(message) {
    const openDSU = require("opendsu");
    const w3cdid = openDSU.loadAPI("w3cdid");
    const scAPI = openDSU.loadAPI("sc");
    const vaultDomain = await promisify(scAPI.getVaultDomain)();
    const dsu = await this.createDSU(vaultDomain, "seed")
    const member = {
        username: message.memberName,
        did: message.memberDID
    }
    const groupDIDDocument = await promisify(w3cdid.resolveDID)(message.groupDID);
    await promisify(groupDIDDocument.addMember)(member.did, member);
}

require("opendsu").loadAPI("m2dsu").defineMapping(checkIfAddMemberToGroupMessage, addMemberToGroupMapping);
export  {addMemberToGroupMapping}
