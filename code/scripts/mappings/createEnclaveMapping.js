import utils from "../utils.js";

const promisify = utils.promisify;

function checkIfCreateEnclaveMessage(message) {
  return message.messageType === "CreateEnclave";
}

async function createEnclave(message) {
  const openDSU = require("opendsu");
  const scAPI = openDSU.loadAPI("sc");
  const resolver = openDSU.loadAPI("resolver");

  const vaultDomain = await promisify(scAPI.getVaultDomain)();
  const dsu = await $$.promisify(resolver.createSeedDSU)(vaultDomain);
  const keySSI = await $$.promisify(dsu.getKeySSIAsString)();

  await utils.initSharedEnclave(keySSI, message)
}

require("opendsu").loadAPI("m2dsu").defineMapping(checkIfCreateEnclaveMessage, createEnclave);
export {createEnclave};
