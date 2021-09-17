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
    const enclaveDB = dbAPI.getMainEnclaveDB();
    const scAPI = openDSU.loadAPI("sc");
    const vaultDomain = await promisify(scAPI.getVaultDomain)();
    const dsu = await this.createDSU(vaultDomain, "seed")
    const group = {}
    group.name = message.groupName;
    let groupName = message.groupName.replaceAll(" ", "_");
    const groupDIDDocument = await promisify(w3cdid.createIdentity)("group", constants.DOMAIN, groupName);
    group.did = groupDIDDocument.getIdentifier();

    await promisify(enclaveDB.insertRecord)(constants.TABLES.GROUPS, group.did, group);
}

require("opendsu").loadAPI("m2dsu").defineMapping(checkIfCreateGroupMessage, createGroup);
export  {createGroup}
