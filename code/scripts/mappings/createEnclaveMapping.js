import constants from "../constants.js";
import utils from "../utils.js";

const promisify = utils.promisify;

function checkIfCreateEnclaveMessage(message) {
  return message.messageType === "CreateEnclave";
}

async function createEnclave(message) {
  const openDSU = require("opendsu");
  const w3cdid = openDSU.loadAPI("w3cdid");
  const dbAPI = openDSU.loadAPI("db");
  const enclaveAPI = openDSU.loadAPI("enclave");

  const enclaveDB = await $$.promisify(dbAPI.getMainEnclaveDB)();
  const scAPI = openDSU.loadAPI("sc");
  const vaultDomain = await promisify(scAPI.getVaultDomain)();
  const dsu = await this.createDSU(vaultDomain, "seed");

  const enclave = enclaveAPI.initialiseWalletDBEnclave();
  const enclaveDID = await $$.promisify(enclave.getDID)();
  const enclaveKeySSI = await $$.promisify(enclave.getKeySSI)();
  const enclaveRecord = {
    enclaveType: message.enclaveType,
    enclaveDID,
    enclaveKeySSI,
    enclaveName: message.enclaveName,
  };

  await enclaveDB.insertRecordAsync(constants.TABLES.GROUP_DATABASES, enclaveDID, enclaveRecord);
}

require("opendsu").loadAPI("m2dsu").defineMapping(checkIfCreateEnclaveMessage, createEnclave);
export { createEnclave };
