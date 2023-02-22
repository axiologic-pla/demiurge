import constants from "../constants.js";
import utils from "../utils.js";
const promisify = utils.promisify;

function checkIfDeleteGroupMessage(message) {
    return message.messageType === "DeleteGroup";
}

async function deleteGroup(message) {
    const openDSU = require("opendsu");
    const scAPI = openDSU.loadAPI("sc");
    const enclaveDB = await $$.promisify(scAPI.getMainEnclave)();
    await promisify(enclaveDB.deleteRecord)(constants.TABLES.GROUPS, message.groupDID);
}

require("opendsu").loadAPI("m2dsu").defineMapping(checkIfDeleteGroupMessage, deleteGroup);
export  {deleteGroup}
