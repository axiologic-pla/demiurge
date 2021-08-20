import constants from "../constants.js";

const { IDENTITY_PK } = constants;
const { IDENTITY: IDENTITY_TABLE } = constants.TABLES;

const openDSU = require("opendsu");
const w3cDID = openDSU.loadAPI("w3cdid");
const persistence = openDSU.loadAPI("persistence");

// async function generateDID(domain, username) {
//   return new Promise((resolve, reject) => {
//     w3cDID.createIdentity("name", domain, username, (err, didDocument) => {
//       if (err) {
//         return reject(err);
//       }
//
//       resolve(didDocument.getIdentifier());
//     });
//   });
// }

// async function generateIdentity(domain) {
//   try {
//     const response = await fetch("/api-standard/user-details");
//     const details = await response.json();
//     return {
//       did: await generateDID(domain, details.username),
//       ...details,
//       domain,
//     };
//   } catch (err) {
//     console.error(`Failed to generate user's identity`, err);
//     return undefined;
//   }
// }

async function _getUserDetails() {
  try {
    const response = await fetch("/api-standard/user-details");
    return await response.json();
  } catch (err) {
    console.error(`Failed to get user's details`, err);
    return {};
  }
}


/**
 * @param {string} did - identifier of DIDDocument
 */
async function setStoredDID(did) {
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
