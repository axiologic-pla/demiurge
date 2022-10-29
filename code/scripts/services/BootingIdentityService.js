import constants from "../constants.js";

const openDSU = require("opendsu");
const dbAPI = openDSU.loadAPI("db");
const scAPI = openDSU.loadAPI("sc");
const w3cDID = openDSU.loadAPI("w3cdid");

/**
 * @param {string} did - identifier of DIDDocument
 */
async function setStoredDID(did, username) {
  const walletStorage = await $$.promisify(dbAPI.getMainEnclave)();
  if(typeof did!=="string") {
    did = did.getIdentifier();
  }
  try {
    await walletStorage.writeKeyAsync(constants.IDENTITY, {did, username});
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

async function getWalletStatus() {
  let walletStorage = await $$.promisify(dbAPI.getMainEnclave)();

  let record;

  try {
    record = await walletStorage.readKeyAsync(constants.IDENTITY);
  } catch (err) {
    // TODO: wait for a future improvement of db from OpenDSU SDK
  }

  if (!record) {
    console.log("Wallet identity not finished yet");
    return undefined;
  }

  return record.walletStatus;
}

async function didWasApproved(did) {
  if (typeof did !== "string") {
    did = did.getIdentifier();
  }
  const didDomain = await $$.promisify(scAPI.getDIDDomain)();
  const epiAdminGroupDID = `did:${constants.SSI_GROUP_DID_TYPE}:${didDomain}:${constants.EPI_ADMIN_GROUP}`
  let epiAdminGroupDIDDocument;
  try{
    epiAdminGroupDIDDocument = await $$.promisify(w3cDID.resolveDID)(epiAdminGroupDID);
  }catch (e) {
    return false;
  }

  const members = await $$.promisify(epiAdminGroupDIDDocument.listMembersByIdentity)();
  const index = members.findIndex(member => member === did);
  return index >= 0;
}

export {getStoredDID, setStoredDID, getWalletStatus, didWasApproved};
