import constants from "../constants.js";

const openDSU = require("opendsu");
const persistence = openDSU.loadAPI("persistence");
const w3cDID = openDSU.loadAPI("w3cdid");

async function generateDID(domain, username) {
  return new Promise((resolve, reject) => {
    w3cDID.createIdentity("name", domain, username, (err, didDocument) => {
      if (err) {
        return reject(err);
      }

      resolve(didDocument.getIdentifier());
    });
  });
}

async function generateIdentity(domain) {
  try {
    const response = await fetch("/api-standard/user-details");
    const details = await response.json();
    return {
      did: await generateDID(domain, details.username),
      ...details,
      domain,
    };
  } catch (err) {
    console.error(`Failed to generate user's identity`, err);
    return undefined;
  }
}

async function getIdentity() {
  const walletStorage = persistence.getWalletStorage();

  const { IDENTITY_PK } = constants;
  const { IDENTITY: IDENTITY_TABLE } = constants.TABLES;

  let identity;

  try {
    identity = await walletStorage.getRecordAsync(IDENTITY_TABLE, IDENTITY_PK);
  } catch (err) {
    // TODO: wait for a future improvement of db from OpenDSU
    if (err.debug_message === `Missing record in table ${IDENTITY_TABLE} and key ${IDENTITY_PK}`) {
      await walletStorage.insertRecordAsync(IDENTITY_TABLE, IDENTITY_PK, {
        ...(await generateIdentity(walletStorage.domainName)),
      });
      identity = await walletStorage.getRecordAsync(IDENTITY_TABLE, IDENTITY_PK);
    } else {
      console.error(err);
    }
  }

  if (!identity) {
    console.error("No identity obtained for current wallet!");
  }

  return identity;
}

export { getIdentity };
