import constants from "../constants.js";
import utils from "../utils.js";
const promisify = utils.promisify;

function checkIfDeleteGroupMessage(message) {
    return message.messageType === "DeleteGroup";
}

async function deleteGroup(message) {
    const openDSU = require("opendsu");
    const dbAPI = openDSU.loadAPI("db");
    const enclaveDB = dbAPI.getMainEnclaveDB();
    const scAPI = openDSU.loadAPI("sc");
    const vaultDomain = await promisify(scAPI.getVaultDomain)();
    const dsu = await this.createDSU(vaultDomain, "seed")
    await promisify(enclaveDB.deleteRecord)(constants.TABLES.GROUPS, message.groupDID);
}

require("opendsu").loadAPI("m2dsu").defineMapping(checkIfDeleteGroupMessage, deleteGroup);
export  {deleteGroup}
