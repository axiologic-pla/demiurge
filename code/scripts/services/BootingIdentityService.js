import constants from "../constants.js";

const { IDENTITY_PK } = constants;
const { IDENTITY: IDENTITY_TABLE } = constants.TABLES;

const openDSU = require("opendsu");
const persistence = openDSU.loadAPI("persistence");

/**
 * @param {string} did - identifier of DIDDocument
 */
async function setStoredDID(did){
  const walletStorage = persistence.getWalletStorage();

  try {
    await walletStorage.insertRecordAsync(IDENTITY_TABLE, IDENTITY_PK, { did });
  } catch (err) {
    console.log(err);
  }
}

async function getStoredDID() {
  const walletStorage = persistence.getWalletStorage();

  let record;

  try {
    record = await walletStorage.getRecordAsync(IDENTITY_TABLE, IDENTITY_PK);
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
