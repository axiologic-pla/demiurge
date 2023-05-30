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
  let notificationHandler = openDSU.loadAPI("error");
  try{
    await enclave.safeBeginBatchAsync();
  }catch (e) {
    return notificationHandler.reportUserRelevantWarning('Failed to begin batch on enclave: ', e)
  }
  for (let dbTableName of tables) {
    for (let indexField of message.enclaveIndexesMap[dbTableName]) {
      try {
        await $$.promisify(enclave.addIndex)(null, dbTableName, indexField)
      } catch (e) {
        const addIndexError = createOpenDSUErrorWrapper(`Failed to add index ${indexField} on table ${dbTableName}`, e);
        try{
          await enclave.cancelBatchAsync();
        } catch (error) {
          return notificationHandler.reportUserRelevantWarning('Failed to cancel batch on enclave: ', error, addIndexError)
        }
        return notificationHandler.reportUserRelevantWarning('Failed to add index on enclave: ', addIndexError);
      }
    }
  }

  try{
      await enclave.commitBatchAsync();
  }catch (e) {
      return notificationHandler.reportUserRelevantWarning('Failed to commit batch on enclave: ', e)
  }

  const enclaveRecord = {
    enclaveType: message.enclaveType,
    enclaveDID,
    enclaveKeySSI,
    enclaveName: message.enclaveName,
  };

  await enclaveDB.safeBeginBatchAsync();
  await enclaveDB.writeKeyAsync(message.enclaveName, enclaveRecord);
  await enclaveDB.insertRecordAsync(constants.TABLES.GROUP_ENCLAVES, enclaveRecord.enclaveDID, enclaveRecord);
  await enclaveDB.commitBatchAsync();
}

require("opendsu").loadAPI("m2dsu").defineMapping(checkIfCreateEnclaveMessage, createEnclave);
export {createEnclave};
