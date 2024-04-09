import constants from "../constants.js";

async function removeMemberFromGroup(message) {
    const openDSU = require("opendsu");
    const w3cdid = openDSU.loadAPI("w3cdid");
    const scAPI = openDSU.loadAPI("sc");
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

async function getGroupCredential(groupDID){
    const openDSU = require("opendsu");
    const scAPI = openDSU.loadAPI("sc");
    const sharedEnclave = await $$.promisify(scAPI.getSharedEnclave)();
    const credentials = await sharedEnclave.filterAsync(constants.TABLES.GROUPS_CREDENTIALS, `groupDID == ${groupDID}`);
    let groupCredential = credentials.find(el => el.credentialType === constants.CREDENTIAL_TYPES.WALLET_AUTHORIZATION);
    return groupCredential;
}

export {
    removeMemberFromGroup,
    getGroupCredential
}