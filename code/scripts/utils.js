import Message from "./utils/Message.js";
import constants from "./constants.js";
import LogService from "./services/LogService.js";

function promisify(fun) {
  return function (...args) {
    return new Promise((resolve, reject) => {
      function callback(err, result) {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      }

      args.push(callback);

      fun.call(this, ...args);
    });
  };
}

function getPKFromContent(stringContent) {
  const crypto = require("opendsu").loadAPI("crypto");
  return crypto.sha256(stringContent);
}

async function sendGroupMessage(sender, group, content, contentType, recipientType, groupOperation) {
  const w3cdid = require("opendsu").loadAPI("w3cdid");
  const groupDIDDocument = await promisify(w3cdid.resolveDID)(group.did);
  const message = new Message();
  message.setSender(sender);
  content = typeof content === "object" ? JSON.stringify(content) : content;
  message.setContent(content);
  message.setGroupDID(group.did);

  message.setRecipientType(recipientType);
  message.setContentType(contentType);
  message.setOperation(groupOperation);

  await promisify(groupDIDDocument.sendMessage)(message);
}

async function sendUserMessage(sender, group, member, content, contentType, recipientType, operation) {
  const w3cdid = require("opendsu").loadAPI("w3cdid");
  let didDocument = await promisify(w3cdid.resolveDID)(sender);
  const receiverDIDDocument = await promisify(w3cdid.resolveDID)(member.did);
  const message = new Message();
  message.setSender(sender);
  message.setContent(content);
  message.setContentType(contentType);
  message.setRecipientType(recipientType);
  message.setGroupDID(group.did);
  message.setOperation(operation);

  await promisify(didDocument.sendMessage)(message, receiverDIDDocument);
}

async function addSharedEnclaveToEnv(enclaveType, enclaveDID, enclaveKeySSI) {
  const openDSU = require("opendsu");
  const scAPI = openDSU.loadAPI("sc");
  const resolver = openDSU.loadAPI("resolver");
  const mainDSU = await $$.promisify(scAPI.getMainDSU)();
  const keySSI = await $$.promisify(mainDSU.getKeySSIAsString)();
  // await $$.promisify(mainDSU.refresh)();
  let env = await $$.promisify(mainDSU.readFile)("/environment.json");
  env = JSON.parse(env.toString());
  env[openDSU.constants.SHARED_ENCLAVE.TYPE] = enclaveType;
  env[openDSU.constants.SHARED_ENCLAVE.DID] = enclaveDID;
  env[openDSU.constants.SHARED_ENCLAVE.KEY_SSI] = enclaveKeySSI;
  // await $$.promisify(mainDSU.refresh)();
  await $$.promisify(mainDSU.writeFile)("/environment.json", JSON.stringify(env));
  scAPI.refreshSecurityContext();
}

async function getDisabledFeatures() {
  const openDSU = require("opendsu");
  const config = openDSU.loadAPI("config");
  let disabledFeaturesArr = [];
  try {
    let disabledFeaturesList = await $$.promisify(config.getEnv)("disabledFeatures");
    if (disabledFeaturesList) {
      let disabledCodesArr = disabledFeaturesList.split(",");
      disabledCodesArr.forEach(item => {
        disabledFeaturesArr.push(item.trim());
      });
    }
  } catch (e) {
    console.log("Couldn't load disabledFeatures");
  }
  return disabledFeaturesArr;
}

async function fetchGroups() {
  const scAPI = require("opendsu").loadAPI("sc");
  const enclaveDB = await $$.promisify(scAPI.getSharedEnclave)();
  let groups;
  try {
    groups = await promisify(enclaveDB.filter)(constants.TABLES.GROUPS);
  } catch (e) {
    return console.log(e);
  }
  return groups;
}

async function addLogMessage(userDID, action, userGroup, actionUserId, logPk, priveleges = "-") {
  let logService = new LogService(constants.TABLES.LOGS_TABLE);
  let logMsg = {
    logPk: logPk,
    actionUserId: actionUserId || WebCardinal.wallet.userName,
    userDID: userDID || "-",
    action: action,
    group: userGroup,
    privileges: priveleges,
  }
  await $$.promisify(logService.log, logService)(logMsg);
  return;
}

function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c === "x" ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function waitForEnclave(enclave, callback) {
  if (enclave.isInitialised()) {
    console.log('[DONE] Enclave is initialized!');
    return callback(undefined);
  }

  console.log('Enclave is not yet initialized!');
  setTimeout(() => {
    waitForEnclave(enclave, callback);
  }, 10);
}

async function isValidDID(stringDID) {
  try {
    const w3cdid = require("opendsu").loadAPI("w3cdid");
    await promisify(w3cdid.resolveDID)(stringDID);
    return true;
  } catch (err) {
    return false;
  }
}

export default {
  promisify,
  getPKFromContent,
  sendGroupMessage,
  sendUserMessage,
  addSharedEnclaveToEnv,
  getDisabledFeatures,
  fetchGroups,
  addLogMessage,
  uuidv4,
  isValidDID,
  waitForEnclave
};
