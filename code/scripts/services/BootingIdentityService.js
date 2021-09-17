import constants from "../constants.js";
import utils from "../utils.js";

const promisify = utils.promisify;

const { IDENTITY_PK } = constants;
const { IDENTITY: IDENTITY_TABLE } = constants.TABLES;

const openDSU = require("opendsu");
const dbAPI = openDSU.loadAPI("db");

/**
 * @param {string} did - identifier of DIDDocument
 */
async function setStoredDID(did, username){
  const walletStorage = dbAPI.getMainEnclaveDB();

  try {
    await promisify(walletStorage.insertRecord)(IDENTITY_TABLE, IDENTITY_PK, { did, username });
  } catch (err) {
    console.log(err);
  }
}

async function getStoredDID() {
  const walletStorage = dbAPI.getMainEnclaveDB();

  let record;

  try {
    record = await promisify(walletStorage.getRecord)(IDENTITY_TABLE, IDENTITY_PK);
  } catch (err) {
    // TODO: wait for a future improvement of db from OpenDSU SDK
  }

  if (!record) {
    console.log("No identity did obtained from db for current wallet!");
    return undefined;
  }

  return record.did;
}

export { getStoredDID, setStoredDID };
