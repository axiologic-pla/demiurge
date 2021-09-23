import constants from "../constants.js";
import getStorageService from "../services/StorageService.js";
import utils from "../utils.js";
const promisify = utils.promisify;

function checkIfCreateGroupMessage(message) {
    return message.messageType === "CreateGroup";
}

async function createGroup(message) {
    const openDSU = require("opendsu");
    const w3cdid = openDSU.loadAPI("w3cdid");
    const dbAPI = openDSU.loadAPI("db");
    const enclaveAPI = openDSU.loadAPI("enclave");

    const enclaveDB = await $$.promisify(dbAPI.getMainEnclaveDB)();
    const scAPI = openDSU.loadAPI("sc");
    const vaultDomain = await promisify(scAPI.getVaultDomain)();
    const dsu = await this.createDSU(vaultDomain, "seed")
    const group = {}
    group.name = message.groupName;
    let groupName = message.groupName.replaceAll(" ", "_");
    const groupDIDDocument = await promisify(w3cdid.createIdentity)("group", constants.DOMAIN, groupName);
    group.did = groupDIDDocument.getIdentifier();

    await promisify(enclaveDB.insertRecord)(constants.TABLES.GROUPS, group.did, group);
    const enclaves = await enclaveDB.filterAsync(constants.TABLES.GROUP_DATABASES);
    if (!enclaves || !enclaves.length) {
        const enclave = enclaveAPI.initialiseWalletDBEnclave();
        const enclaveDID = await $$.promisify(enclave.getDID)();
        const enclaveKeySSI = await $$.promisify(enclave.getKeySSI)();
        const enclaveRecord = {
            enclaveType: openDSU.constants.ENCLAVE_TYPES.WALLET_DB_ENCLAVE,
            enclaveDID,
            enclaveKeySSI,
        };

        await enclaveDB.insertRecordAsync(constants.TABLES.GROUP_DATABASES, enclaveDID, enclaveRecord);
    }
}

require("opendsu").loadAPI("m2dsu").defineMapping(checkIfCreateGroupMessage, createGroup);
export  {createGroup}
