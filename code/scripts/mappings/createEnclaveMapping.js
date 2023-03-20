import constants from "../constants.js";
import utils from "../utils.js";

const promisify = utils.promisify;

function checkIfCreateEnclaveMessage(message) {
  return message.messageType === "CreateEnclave";
}

async function createEnclave(message) {
  const openDSU = require("opendsu");
  const scAPI = openDSU.loadAPI("sc");
  const enclaveAPI = openDSU.loadAPI("enclave");
  const resolver = openDSU.loadAPI("resolver");

  const enclaveDB = await $$.promisify(scAPI.getMainEnclave)();
  const vaultDomain = await promisify(scAPI.getVaultDomain)();
  const dsu = await $$.promisify(resolver.createSeedDSU)(vaultDomain);
  const keySSI = await $$.promisify(dsu.getKeySSIAsString)();
  const enclave = enclaveAPI.initialiseWalletDBEnclave(keySSI);

  function waitForEnclaveInitialization() {
    return new Promise((resolve) => {
      enclave.on("initialised", resolve)
    })
  }

  await waitForEnclaveInitialization();

  const enclaveDID = await $$.promisify(enclave.getDID)();
  const enclaveKeySSI = await $$.promisify(enclave.getKeySSI)();

  let tables = Object.keys(message.enclaveIndexesMap);
  for (let dbTableName of tables) {
    for (let indexField of message.enclaveIndexesMap[dbTableName]) {
      try {
        await $$.promisify(enclave.addIndex)(null, dbTableName, indexField)
      } catch (e) {
        const openDSU = require("opendsu");
        let notificationHandler = openDSU.loadAPI("error");
        notificationHandler.reportUserRelevantWarning('Failed to setup index on enclave: ', e)
      }
    }
  }

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
export {createEnclave};
