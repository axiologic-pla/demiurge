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
  const tryToSetStoredDID = async () => {
    if (typeof did !== "string") {
      did = did.getIdentifier();
    }
    await walletStorage.safeBeginBatchAsync();
    try {
      await walletStorage.writeKeyAsync(constants.IDENTITY, {did, walletStatus});
      await walletStorage.commitBatchAsync();
    } catch (e) {
      try {
        await walletStorage.cancelBatchAsync();
      } catch (err) {
        console.log(err);
      }
      await tryToSetStoredDID();
    }
  }
  let identity;
  try {
    identity = await walletStorage.readKeyAsync(constants.IDENTITY);
  } catch (e) {
    identity = undefined;
  }

  if(identity && identity.did === did && identity.walletStatus === walletStatus){
    return;
  }

  await tryToSetStoredDID();
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
  await walletStorage.safeBeginBatchAsync();

  try {
    await walletStorage.writeKeyAsync(constants.WALLET_STATUS, walletStatus);
    await walletStorage.commitBatchAsync();
  } catch (err) {
    try {
      await walletStorage.cancelBatchAsync();
    } catch (e) {
      return console.log(e, err);
    }
    throw new Error("Failed to ensure wallet state.");
  }
}

async function getWalletStatus() {
  let walletStorage = await $$.promisify(dbAPI.getMainEnclave)();
  let record;

  try {
    record = await walletStorage.readKeyAsync(constants.WALLET_STATUS);
  } catch (err) {
    //ignorable at this point in time
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

async function setMainDID(typicalBusinessLogicHub, didDocument, notificationHandler) {
  if (typeof didDocument === "object") {
    didDocument = didDocument.getIdentifier();
  }
  try {
    await $$.promisify(typicalBusinessLogicHub.setMainDID)(didDocument);
  } catch (e) {
    notificationHandler.reportUserRelevantInfo(`Failed to initialise communication layer. Retrying ...`);
    await setMainDID(typicalBusinessLogicHub, didDocument);
  }
}

export {getStoredDID, setStoredDID, getWalletStatus, didWasApproved, setWalletStatus, setMainDID};
