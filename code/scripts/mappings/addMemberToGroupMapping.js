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
    const crypto = openDSU.loadAPI("crypto");
    const dbAPI = openDSU.loadAPI("db");
    const enclaveAPI = openDSU.loadAPI("enclave");
    const enclaveDB = await $$.promisify(dbAPI.getMainEnclaveDB)();
    const vaultDomain = await promisify(scAPI.getVaultDomain)();
    const dsu = await this.createDSU(vaultDomain, "seed")
    const member = {
        username: message.memberName,
        did: message.memberDID
    }
    const groupDIDDocument = await promisify(w3cdid.resolveDID)(message.groupDID);
    await promisify(groupDIDDocument.addMember)(member.did, member);
    const adminDIDs = await enclaveDB.filterAsync(constants.TABLES.IDENTITY);
    const adminDID = adminDIDs[0].did;
    const adminDID_Document = await $$.promisify(w3cdid.resolveDID)(adminDID);
    const memberDID_Document = await $$.promisify(w3cdid.resolveDID)(member.did);
    const credential = await promisify(crypto.createCredentialForDID)(adminDID, message.groupDID);

    const enclaves = await enclaveDB.filterAsync(constants.TABLES.GROUP_DATABASES);
    const enclave = enclaves[0];
    const enclaveRecord = {
        enclaveType: openDSU.constants.ENCLAVE_TYPES.WALLET_DB_ENCLAVE,
        enclaveDID: enclave.enclaveDID,
        enclaveKeySSI: enclave.enclaveKeySSI
    }
    const msg = {
        credential,
        enclave: enclaveRecord
    }
    await $$.promisify(adminDID_Document.sendMessage)(crypto.encodeBase58(JSON.stringify(msg)), memberDID_Document);
}

require("opendsu").loadAPI("m2dsu").defineMapping(checkIfAddMemberToGroupMessage, addMemberToGroupMapping);
export  {addMemberToGroupMapping}
