import constants from "../constants.js";

async function removeMemberFromGroup(message) {
    const openDSU = require("opendsu");
    const w3cdid = openDSU.loadAPI("w3cdid");
    const scAPI = openDSU.loadAPI("sc");
    const vaultDomain = await $$.promisify(scAPI.getVaultDomain)();
    const dsu = await this.createDSU(vaultDomain, "seed")
    const groupDIDDocument = await $$.promisify(w3cdid.resolveDID)(message.groupDID);
    await $$.promisify(groupDIDDocument.removeMembers)([message.memberDID]);
    const mainEnclave = await $$.promisify(scAPI.getMainEnclave)();
    let adminDID = await mainEnclave.readKeyAsync(constants.IDENTITY);
    const adminDID_Document = await $$.promisify(w3cdid.resolveDID)(adminDID.did);
    let memberDID_Document = await $$.promisify(w3cdid.resolveDID)(message.memberDID);
    const msg = {
        messageType: message.messageType
    };
    await $$.promisify(adminDID_Document.sendMessage)(JSON.stringify(msg), memberDID_Document);
}

export {
    removeMemberFromGroup
}