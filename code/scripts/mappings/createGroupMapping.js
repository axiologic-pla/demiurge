import constants from "../constants.js";
import utils from "../utils.js";

const promisify = utils.promisify;

function checkIfCreateGroupMessage(message) {
  return message.messageType === "CreateGroup";
}

async function createGroup(message) {
  const openDSU = require("opendsu");
  const w3cdid = openDSU.loadAPI("w3cdid");
  const scAPI = openDSU.loadAPI("sc");
  const enclaveAPI = openDSU.loadAPI("enclave");
  const enclaveDB = await $$.promisify(scAPI.getMainEnclave)();
  const vaultDomain = await promisify(scAPI.getVaultDomain)();
  const didDomain = await promisify(scAPI.getDIDDomain)();
  const mainDSU = await promisify(scAPI.getMainDSU)();
  const dsu = await this.createDSU(vaultDomain, "seed");

  const group = {};
  group.name = message.groupName;
  let groupName = message.groupName.replaceAll(" ", "_");
  let groupDIDDocument;
  try {
    groupDIDDocument = await $$.promisify(w3cdid.resolveDID)(`did:ssi:group:${didDomain}:${groupName}`);
  } catch (e) {}
  if (typeof groupDIDDocument === "undefined") {
    groupDIDDocument = await promisify(w3cdid.createIdentity)("ssi:group", didDomain, groupName);
    group.did = groupDIDDocument.getIdentifier();

    const sharedEnclaveDB = await $$.promisify(scAPI.getSharedEnclave)();
    await sharedEnclaveDB.insertRecordAsync(constants.TABLES.GROUPS, group.did, group);

    const adminDID = await enclaveDB.readKeyAsync(constants.IDENTITY);
    const adminDID_Document = await $$.promisify(w3cdid.resolveDID)(adminDID.did);
    const msg = {
      sender: adminDID.did,
    };
    await $$.promisify(adminDID_Document.sendMessage)(JSON.stringify(msg), adminDID_Document);
  }
}

require("opendsu").loadAPI("m2dsu").defineMapping(checkIfCreateGroupMessage, createGroup);
export { createGroup };
