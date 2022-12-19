import constants from "../constants.js";

const openDSU = require("opendsu");
const dbAPI = openDSU.loadAPI("db");
const scAPI = openDSU.loadAPI("sc");
const w3cDID = openDSU.loadAPI("w3cdid");

/**
 * @param {string} did - identifier of DIDDocument
 */
async function setStoredDID(did, walletStatus = constants.ACCOUNT_STATUS.WAITING_APPROVAL) {
  const walletStorage = await $$.promisify(dbAPI.getMainEnclave)();
  if (typeof did !== "string") {
    did = did.getIdentifier();
  }
  try {
    await walletStorage.writeKeyAsync(constants.IDENTITY, {did, walletStatus});
  } catch (err) {
    console.log(err);
  }
}

async function getStoredDID() {
  let walletStorage = await $$.promisify(dbAPI.getMainEnclave)();

  let record;

  try {
    record = await walletStorage.readKeyAsync(constants.IDENTITY);
  } catch (err) {
    // TODO: wait for a future improvement of db from OpenDSU SDK
  }

  if (!record) {
    console.log("No identity did obtained from db for current wallet!");
    return undefined;
  }

  return record.did;
}

async function setWalletStatus(walletStatus) {
  const walletStorage = await $$.promisify(dbAPI.getMainEnclave)();
  try {
    await walletStorage.writeKeyAsync(constants.WALLET_STATUS,  walletStatus);
  } catch (err) {
    console.log(err);
  }
}

async function getWalletStatus() {
  let walletStorage = await $$.promisify(dbAPI.getMainEnclave)();

  let record;

  try {
    record = await walletStorage.readKeyAsync(constants.WALLET_STATUS);
  } catch (err) {
    // TODO: wait for a future improvement of db from OpenDSU SDK
  }

  if (!record) {
    try {
      record = await walletStorage.readKeyAsync(constants.IDENTITY);
      if (record) {
        record = record.walletStatus;
      }
    } catch (err) {
      // TODO: wait for a future improvement of db from OpenDSU SDK
    }
  }

  return record;
}

async function didWasApproved(did) {
  if (typeof did !== "string") {
    did = did.getIdentifier();
  }

  let adminGroupDIDDocument, groups = [];
  try {
    const sharedEnclave = await $$.promisify(scAPI.getSharedEnclave)();
    groups = await $$.promisify(sharedEnclave.filter)(constants.TABLES.GROUPS);
    const adminGroup = groups.find((gr) => gr.accessMode === constants.ADMIN_ACCESS_MODE || gr.name === constants.EPI_ADMIN_GROUP_NAME) || {};
    adminGroupDIDDocument = await $$.promisify(w3cDID.resolveDID)(adminGroup.groupDID);
  } catch (e) {
    return false;
  }

  const members = await $$.promisify(adminGroupDIDDocument.listMembersByIdentity)();
  const index = members.findIndex(member => member === did);
  return index >= 0;
}

export {getStoredDID, setStoredDID, getWalletStatus, didWasApproved, setWalletStatus};
