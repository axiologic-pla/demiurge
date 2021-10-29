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
  const keySSI = await $$.promisify(dsu.getKeySSIAsString)();
  const enclave = enclaveAPI.initialiseWalletDBEnclave(keySSI);
  const enclaveDID = await $$.promisify(enclave.getDID)();
  const enclaveKeySSI = await $$.promisify(enclave.getKeySSI)();
  const enclaveRecord = {
    enclaveType: message.enclaveType,
    enclaveDID,
    enclaveKeySSI,
    enclaveName: message.enclaveName,
  };

  await enclaveDB.writeKeyAsync(message.enclaveName, enclaveRecord);
  await enclaveDB.insertRecordAsync(constants.TABLES.GROUP_ENCLAVES, enclaveRecord.enclaveDID, enclaveRecord);
}

require("opendsu").loadAPI("m2dsu").defineMapping(checkIfCreateEnclaveMessage, createEnclave);
export { createEnclave };
