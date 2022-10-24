import constants from "../constants.js";
import utils from "../utils.js";

const promisify = utils.promisify;

const {IDENTITY_PK} = constants;
const {IDENTITY: IDENTITY_TABLE} = constants.TABLES;

const openDSU = require("opendsu");
const dbAPI = openDSU.loadAPI("db");

/**
 * @param {string} did - identifier of DIDDocument
 */
async function setStoredDID(did, username, walletStatus) {
  const walletStorage = await $$.promisify(dbAPI.getMainEnclave)();

  try {
    await walletStorage.writeKeyAsync(constants.IDENTITY, {did, username, walletStatus});
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

  return record.walletStatus
}

export {getStoredDID, setStoredDID, getWalletStatus};
