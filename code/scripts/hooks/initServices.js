import constants from "../constants.js";
import utils from "../utils.js";
import DSUStorage from "../../webcardinal/base/libs/DSUStorage.js";
import getStorageService from "../services/StorageService.js";
import getMessageProcessingService from "../services/MessageProcessingService.js";

const openDSU = require("opendsu");
const w3cDID = openDSU.loadAPI("w3cdid");
const keySSISpace = openDSU.loadAPI("keyssi");
const scAPI = openDSU.loadAPI("sc");

const dsuStorage = new DSUStorage();

function ensureStorageServiceIsInitialised(callback) {
  loadSecurityContext(async (err) => {
    if (err) {
      return initialiseSecurityContext((err) => {
        if (err) {
          return callback(err);
        }

        createSSIForStorageService(async (err) => {
          if (err) {
            return callback(err);
          }

          try {
            const { did, details } = await getUser();
            const storageService = initialiseStorageService();
            await storageService.insertRecordAsync(constants.TABLES.IDENTITY, constants.IDENTITY_PK, {
              did,
              ...details,
            });
            const identity = await storageService.getRecordAsync(constants.TABLES.IDENTITY, constants.IDENTITY_PK);
            const messageProcessingService = getMessageProcessingService(storageService, identity);
            return callback(undefined, {
              dsuStorage,
              storageService,
              identity,
              messageProcessingService,
            });
          } catch (e) {
            return callback(e);
          }
        });
      });
    }

    try {
      const storageService = initialiseStorageService();
      const identity = await storageService.getRecordAsync(constants.TABLES.IDENTITY, constants.IDENTITY_PK);
      const messageProcessingService = getMessageProcessingService(storageService, identity);
      return callback(undefined, {
        dsuStorage,
        storageService,
        identity,
        messageProcessingService,
      });
    } catch (err) {
      return callback(err);
    }
  });
}

function loadSecurityContext(callback) {
  dsuStorage.getObject(constants.SECURITY_CONTEXT_KEY_SSI_PATH, (err, keySSIObj) => {
    if (err || !keySSIObj) {
      return callback(Error(`Failed to load security context`));
    }

    scAPI.getSecurityContext(keySSIObj.keySSI);
    callback(undefined);
  });
}

function initialiseSecurityContext(callback) {
  keySSISpace.createSeedSSI(constants.DOMAIN, (err, scKeySSI) => {
    if (err) {
      return callback(err);
    }
    scKeySSI = scKeySSI.getIdentifier();
    require("opendsu").loadAPI("sc").getSecurityContext(scKeySSI);
    dsuStorage.setObject(constants.SECURITY_CONTEXT_KEY_SSI_PATH, { keySSI: scKeySSI }, callback);
  });
}

function initialiseStorageService() {
  const { promisify } = utils;
  const storageService = getStorageService(dsuStorage);
  storageService.insertRecordAsync = promisify(storageService.insertRecord);
  storageService.getRecordAsync = promisify(storageService.getRecord);
  storageService.updateRecordAsync = promisify(storageService.updateRecord);
  storageService.deleteRecordAsync = promisify(storageService.deleteRecord);
  storageService.filterAsync = promisify(storageService.filter);
  return storageService;
}

function createSSIForStorageService(callback) {
  keySSISpace.createSeedSSI(constants.DOMAIN, (err, dbKeySSI) => {
    if (err) {
      return callback(err);
    }

    dsuStorage.setObject(
      constants.DB_KEY_SSI_PATH,
      {
        keySSI: dbKeySSI.getIdentifier(),
      },
      callback
    );
  });
}

async function generateIdentity(username) {
  return new Promise((resolve, reject) => {
    w3cDID.createIdentity("name", constants.DOMAIN, username, (err, didDocument) => {
      if (err) {
        return reject(err);
      }

      resolve(didDocument.getIdentifier());
    });
  });
}

async function getUser() {
  try {
    const response = await fetch("/api-standard/user-details");
    const userDetails = await response.json();
    return {
      did: await generateIdentity(userDetails.username),
      details: userDetails,
    };
  } catch (err) {
    console.error(`Failed to generate user's DID`, err);
    return undefined;
  }
}

export function init() {
  return new Promise((resolve, reject) => {
    ensureStorageServiceIsInitialised((err, identity) => {
      if (err) {
        return reject(err);
      }

      return resolve(identity);
    });
  });
}
