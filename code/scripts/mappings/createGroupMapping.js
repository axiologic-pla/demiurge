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
  const dsu = await this.createDSU(vaultDomain, "seed");

  const group = {};
  group.name = message.groupName;
  let groupName = message.groupName.replaceAll(" ", "_");
  let groupDIDDocument;
  try {
    groupDIDDocument = await $$.promisify(w3cdid.resolveDID)(`did:ssi:group:${vaultDomain}:${groupName}`);
  } catch (e) {}
  if (typeof groupDIDDocument === "undefined") {
    groupDIDDocument = await promisify(w3cdid.createIdentity)("group", vaultDomain, groupName);
    group.did = groupDIDDocument.getIdentifier();

    await enclaveDB.insertRecordAsync(constants.TABLES.GROUPS, group.did, group);
    const adminDIDs = await enclaveDB.filterAsync(constants.TABLES.IDENTITY);
    const adminDID = adminDIDs[0].did;
    const adminDID_Document = await $$.promisify(w3cdid.resolveDID)(adminDID);
    const msg = {
      sender: adminDID,
    };
    await $$.promisify(adminDID_Document.sendMessage)(JSON.stringify(msg), adminDID_Document);
  }
}

require("opendsu").loadAPI("m2dsu").defineMapping(checkIfCreateGroupMessage, createGroup);
export { createGroup };
