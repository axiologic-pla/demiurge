import Message from "./utils/Message.js";
import constants from "./constants.js";
import LogService from "./services/LogService.js";
import {getGroupCredential} from "./mappings/utils.js";
import {getStoredDID} from "./services/BootingIdentityService.js";
const openDSU = require("opendsu");
const apiKeySpace = openDSU.loadAPI("apiKey");
const crypto = openDSU.loadAPI("crypto");
const w3cdid = openDSU.loadAPI("w3cdid");
const scAPI = openDSU.loadAPI("sc");
const enclaveAPI = openDSU.loadAPI("enclave");
const resolver = openDSU.loadAPI("resolver");
const config = openDSU.loadAPI("config");
let notificationHandler = openDSU.loadAPI("error");

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
  return crypto.sha256(stringContent);
}

async function sendGroupMessage(sender, group, content, contentType, recipientType, groupOperation) {
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

async function writeEnvironmentFile(mainDSU, env) {
  let batchId = await mainDSU.startOrAttachBatchAsync();
  try {
    await $$.promisify(mainDSU.writeFile)("/environment.json", JSON.stringify(env));
    await mainDSU.commitBatchAsync(batchId);
  } catch (e) {
    const writeFileError = createOpenDSUErrorWrapper(`Failed to write environment.json`, e);
    try {
      await mainDSU.cancelBatchAsync(batchId);
    } catch (e) {
      throw createOpenDSUErrorWrapper(`Failed to cancel batch`, e, writeFileError);
    }

    throw writeFileError;
  }
  scAPI.refreshSecurityContext();
}

//recovery arg is used to determine if the enclave is created for the first time or a recovery is performed
async function initSharedEnclave(keySSI, enclaveConfig, recovery) {
  const enclaveDB = await $$.promisify(scAPI.getMainEnclave)();
  if (recovery) {
    try {
      await $$.promisify(resolver.loadDSU)(keySSI);
    } catch (e) {
      await $$.promisify(resolver.createDSUForExistingSSI)(keySSI);
    }
  }
  let enclave;
  try {
    enclave = enclaveAPI.initialiseWalletDBEnclave(keySSI);

    function waitForEnclaveInitialization() {
      return new Promise((resolve) => {
        enclave.on("initialised", resolve)
      })
    }

    await waitForEnclaveInitialization();
  } catch (e) {
    throw e
  }


  const enclaveDID = await $$.promisify(enclave.getDID)();
  let enclaveKeySSI = await $$.promisify(enclave.getKeySSI)();
  enclaveKeySSI = enclaveKeySSI.getIdentifier();
  let tables = Object.keys(enclaveConfig.enclaveIndexesMap);
  let bID;

  try {
    bID = await enclave.startOrAttachBatchAsync();
  } catch (e) {
    return notificationHandler.reportUserRelevantWarning('Failed to begin batch on enclave: ', e)
  }
  for (let dbTableName of tables) {
    for (let indexField of enclaveConfig.enclaveIndexesMap[dbTableName]) {
      try {
        await $$.promisify(enclave.addIndex)(null, dbTableName, indexField)
      } catch (e) {
        const addIndexError = createOpenDSUErrorWrapper(`Failed to add index ${indexField} on table ${dbTableName}`, e);
        try {
          await enclave.cancelBatchAsync(bID);
        } catch (error) {
          return notificationHandler.reportUserRelevantWarning('Failed to cancel batch on enclave: ', error, addIndexError)
        }
        return notificationHandler.reportUserRelevantWarning('Failed to add index on enclave: ', addIndexError);
      }
    }
  }

  try {
    await enclave.commitBatchAsync(bID);
  } catch (e) {
    return notificationHandler.reportUserRelevantWarning('Failed to commit batch on enclave: ', e)
  }

  const enclaveRecord = {
    enclaveType: enclaveConfig.enclaveType,
    enclaveDID,
    enclaveKeySSI,
    enclaveName: enclaveConfig.enclaveName,
  };

  let batchId = await enclaveDB.startOrAttachBatchAsync();
  await enclaveDB.writeKeyAsync(enclaveConfig.enclaveName, enclaveRecord);
  await enclaveDB.insertRecordAsync(constants.TABLES.GROUP_ENCLAVES, enclaveRecord.enclaveDID, enclaveRecord);
  await enclaveDB.commitBatchAsync(batchId);
  return enclaveRecord;
}


async function addSharedEnclaveToEnv(enclaveType, enclaveDID, enclaveKeySSI) {
  const mainDSU = await $$.promisify(scAPI.getMainDSU)();
  let env = await $$.promisify(mainDSU.readFile)("/environment.json");
  env = JSON.parse(env.toString());
  env[openDSU.constants.SHARED_ENCLAVE.TYPE] = enclaveType;
  env[openDSU.constants.SHARED_ENCLAVE.DID] = enclaveDID;
  env[openDSU.constants.SHARED_ENCLAVE.KEY_SSI] = enclaveKeySSI;
  await writeEnvironmentFile(mainDSU, env);
}

async function getSharedEnclaveDataFromEnv() {
  const mainDSU = await $$.promisify(scAPI.getMainDSU)();
  let env = await $$.promisify(mainDSU.readFile)("/environment.json");
  env = JSON.parse(env.toString());
  let data = {
    "enclaveType": env[openDSU.constants.SHARED_ENCLAVE.TYPE],
    "enclaveDID": env[openDSU.constants.SHARED_ENCLAVE.DID],
    "enclaveKeySSI": env[openDSU.constants.SHARED_ENCLAVE.KEY_SSI]
  }
  return data;
}

async function setEpiEnclave(enclaveRecord) {
  const sharedEnclave = await $$.promisify(scAPI.getSharedEnclave)();
  await sharedEnclave.writeKeyAsync(constants.EPI_SHARED_ENCLAVE, enclaveRecord);
  await $$.promisify(config.setEnv)(constants.EPI_SHARED_ENCLAVE, enclaveRecord.enclaveKeySSI);
}

async function removeSharedEnclaveFromEnv() {
  const mainDSU = await $$.promisify(scAPI.getMainDSU)();
  let env = await $$.promisify(mainDSU.readFile)("/environment.json");
  env = JSON.parse(env.toString());
  if (!env[openDSU.constants.SHARED_ENCLAVE.TYPE]) {
    return;
  }
  env[openDSU.constants.SHARED_ENCLAVE.TYPE] = undefined;
  env[openDSU.constants.SHARED_ENCLAVE.DID] = undefined;
  env[openDSU.constants.SHARED_ENCLAVE.KEY_SSI] = undefined;
  await writeEnvironmentFile(mainDSU, env);
}

async function getManagedFeatures() {
  let managedFeatures = {};
  try {
    for (let i = 0; i < constants.MANAGED_FEATURES_ARR.length; i++) {
      managedFeatures[constants.MANAGED_FEATURES_ARR[i]] = await $$.promisify(config.getEnv)(constants.MANAGED_FEATURES_ARR[i]);
    }
  } catch (e) {
    console.log("Couldn't load disabledFeatures");
  }
  return managedFeatures;
}

async function fetchGroups() {
  const enclaveDB = await $$.promisify(scAPI.getSharedEnclave)();
  let groups;
  try {
    groups = await promisify(enclaveDB.filter)(constants.TABLES.GROUPS);
  } catch (e) {
    return console.log(e);
  }
  return groups;
}

async function addLogMessage(userDID, action, userGroup, actionUserId, logPk, privileges = "-", actionDate) {
  try {
    let logService = new LogService(constants.TABLES.LOGS_TABLE);
    let logMsg = {
      logPk: logPk,
      actionUserId: actionUserId || WebCardinal.wallet.userName,
      userDID: userDID || "-",
      action: action,
      group: userGroup,
      privileges: privileges,
    }

    if(actionDate){
      logMsg.actionDate = actionDate;
    }

    await $$.promisify(logService.log, logService)(logMsg);
  } catch (e) {
    console.error("Very highly improbable fail to record a log (maybe the user is without network connection or without permissions) ", e);
  }
}

function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
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
    await promisify(w3cdid.resolveDID)(stringDID);
    return true;
  } catch (err) {
    return false;
  }
}

async function getGroupByType(sharedEnclave, accessMode, groupName) {
  const _getGroup = async () => {
    try {
      const groups = await promisify(sharedEnclave.filter)(constants.TABLES.GROUPS);
      const group = groups.find(gr => gr.accessMode === accessMode || gr.name === groupName) || {};
      if (!group) {
        throw new Error(`Group ${groupName} not found in the shared enclave`);
      }
      return group;
    } catch (e) {
      notificationHandler.reportUserRelevantWarning(`Failed to retrieve configuration data. Retrying ...`);
      notificationHandler.reportUserRelevantInfo(`Failed to get info about group. Retrying ...`, e);
      throw e;
    }
  }
  return await retryAsyncFunction(_getGroup, 3, 100);
}

// Specific functions for admin, write, and read groups, utilizing the generic function
async function getAdminGroup(sharedEnclave) {
  return getGroupByType(sharedEnclave, constants.ADMIN_ACCESS_MODE, constants.EPI_ADMIN_GROUP_NAME);
}

async function getWriteGroup(sharedEnclave) {
  return getGroupByType(sharedEnclave, constants.WRITE_ACCESS_MODE, constants.EPI_WRITE_GROUP);
}

async function getReadGroup(sharedEnclave) {
  return getGroupByType(sharedEnclave, constants.READ_ONLY_ACCESS_MODE, constants.EPI_READ_GROUP);
}

async function associateGroupAccess(sharedEnclave, groupType) {
  const AVAILABLE_ACCESS_MODES = [constants.WRITE_ACCESS_MODE, constants.READ_ONLY_ACCESS_MODE];
  if (!AVAILABLE_ACCESS_MODES.includes(groupType)) {
    throw new Error(`Invalid group type: ${groupType}`);
  }

  const apiKeyClient = apiKeySpace.getAPIKeysClient();
  const group = groupType === constants.WRITE_ACCESS_MODE ? await getWriteGroup(sharedEnclave) : await getReadGroup(sharedEnclave);
  const groupDIDDocument = await $$.promisify(w3cdid.resolveDID)(group.did);
  const members = await $$.promisify(groupDIDDocument.getMembers)();
  for (let member in members) {
    const memberObject = members[member];
    const apiKey = {
      scope: groupType,
      secret: crypto.sha256JOSE(crypto.generateRandom(32), "base64")
    };
    await apiKeyClient.associateAPIKey(
        constants.APPS.DSU_FABRIC,
        constants.API_KEY_NAME,
        getUserIdFromUsername(memberObject.username),
        JSON.stringify(apiKey)
    );
  }
}

function getGroupName(group) {
  const segments = group.did.split(":");
  let groupName = segments.pop();
  return groupName;
}

function renderToast(message, type, timeoutValue = 15000) {
  let toastContainer = document.querySelector(".toast-container");
  let toastElement = document.createElement("div");
  toastElement.classList.add("toast");
  toastElement.classList.add(type);
  toastElement.innerHTML = `<p class="toast-text">${message}</p>`
  let toastButton = document.createElement("div");
  toastButton.classList.add("toast-close-button");
  toastButton.innerHTML = `<svg width="14" height="15" viewBox="0 0 14 15" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M13.705 2.20934C13.8928 2.02156 13.9983 1.76687 13.9983 1.50131C13.9983 1.23575 13.8928 0.981059 13.705 0.793278C13.5172 0.605495 13.2625 0.5 12.997 0.5C12.7314 0.5 12.4767 0.605495 12.2889 0.793278L7 6.08352L1.70944 0.794943C1.52165 0.607161 1.26695 0.501666 1.00137 0.501666C0.735788 0.501666 0.481087 0.607161 0.293294 0.794943C0.105501 0.982724 2.79833e-09 1.23741 0 1.50297C-2.79833e-09 1.76854 0.105501 2.02322 0.293294 2.21101L5.58385 7.49958L0.29496 12.7898C0.107167 12.9776 0.00166609 13.2323 0.00166609 13.4979C0.0016661 13.7634 0.107167 14.0181 0.29496 14.2059C0.482752 14.3937 0.737454 14.4992 1.00303 14.4992C1.26861 14.4992 1.52331 14.3937 1.71111 14.2059L7 8.91565L12.2906 14.2067C12.4784 14.3945 12.7331 14.5 12.9986 14.5C13.2642 14.5 13.5189 14.3945 13.7067 14.2067C13.8945 14.0189 14 13.7643 14 13.4987C14 13.2331 13.8945 12.9784 13.7067 12.7907L8.41615 7.49958L13.705 2.20934Z" fill="black"/>
</svg>`
  toastButton.addEventListener(constants.HTML_EVENTS.CLICK, () => {
    if (toastElement && toastElement.parentElement) {
      toastElement.parentNode.removeChild(toastElement);
    }
  })
  toastElement.appendChild(toastButton);
  setTimeout(() => {
    if (toastElement && toastElement.parentElement) {
      toastElement.parentNode.removeChild(toastElement);
    }
  }, timeoutValue)
  toastContainer.appendChild(toastElement);
}

async function readMappingEngineMessages(path, DSUStorage) {
  let messages;
  try {
    messages = await $$.promisify(DSUStorage.getObject, DSUStorage)(path);
  } catch (e) {

  }
  if (!messages) {
    notificationHandler.reportUserRelevantWarning(`Failed to retrieve configuration data. Retrying ...`);
    return await this.readMappingEngineMessages(path, DSUStorage);
  }
  return messages;
}

async function autoAuthorization(did) {
  let SecretsHandler = w3cdid.SecretsHandler;
  let handler = await SecretsHandler.getInstance(did);
  let domain = await $$.promisify(scAPI.getVaultDomain)();
  const enclaveData = await getSharedEnclaveDataFromEnv();
  let groupCredential = await getGroupCredential(`did:ssi:name:${domain}:${constants.EPI_ADMIN_GROUP}`);
  await handler.authorizeUser(did, groupCredential, enclaveData);
}

async function setWalletStatus(walletStatus) {
  const walletStorage = await $$.promisify(scAPI.getMainEnclave)();
  let batchId = await walletStorage.startOrAttachBatchAsync();

  try {
    await walletStorage.writeKeyAsync(constants.WALLET_STATUS, walletStatus);
    await walletStorage.commitBatchAsync(batchId);
  } catch (err) {
    try {
      await walletStorage.cancelBatchAsync(batchId);
    } catch (e) {
      return console.log(e, err);
    }
    throw new Error("Failed to ensure wallet state.");
  }
}

async function getWalletStatus() {
  let walletStorage = await $$.promisify(scAPI.getMainEnclave)();
  let record;

  try {
    record = await walletStorage.readKeyAsync(constants.WALLET_STATUS);
  } catch (err) {
    //ignorable at this point in time
  }

  return record;
}

function showTextLoader() {
  if (document.querySelector("stencil-route:not([style='display: none;'])")) {
    document.querySelector("stencil-route:not([style='display: none;'])").classList.add("hidden");
  }
  window.WebCardinal.loader.hidden = false;
  window.WebCardinal.loader.classList.add("text-below");
}

function hideTextLoader() {
  setTimeout(() => {
    if (window.WebCardinal.loader.classList.contains("text-below")) {
      window.WebCardinal.loader.hidden = true;
      window.WebCardinal.loader.classList.remove("text-below");
    }

    if (document.querySelector("stencil-route.hidden")) {
      document.querySelector("stencil-route.hidden").classList.remove("hidden");
    }
  })
}

function getUserIdFromUsername(username) {
  const DSU_FABRIC = 'DSU_Fabric/';
  const DEMIURGE = 'Demiurge/';
  // if DSU_FABRIC username format:  DSU_Fabric/user@domain
  if (username.includes(DSU_FABRIC)) {
    username = username.replace(DSU_FABRIC, '');
    if (username.includes('@')) {
      username = username.replace(/\d+$/, '');
    }
  } else if (username.includes(DEMIURGE)) {
    username = username.replace(DEMIURGE, '');
    if (username.includes('/')) {
      username = username.replace(/\d+$/, '');
      username = username.replaceAll("/", "@");
    }
  }
  return username;
}

const setSharedEnclaveKey = async (key, value) => {
  const sharedEnclave = await $$.promisify(scAPI.getSharedEnclave)();
  let batchId = await sharedEnclave.startOrAttachBatchAsync();
  try {
    await sharedEnclave.writeKeyAsync(key, value);
    await sharedEnclave.commitBatchAsync(batchId);
  } catch (e) {
    await sharedEnclave.cancelBatchAsync(batchId);
    throw e;
  }
}

const getSharedEnclaveKey = async (key) => {
  const sharedEnclave = await $$.promisify(scAPI.getSharedEnclave)();
  let record;
  try {
    record = await sharedEnclave.readKeyAsync(key);
  } catch (e) {
    // ignore
  }
  return record;
}

const setSysadminCreated = async (sysadminCreated) => {
  return await setSharedEnclaveKey(constants.SYSADMIN_CREATED, sysadminCreated);
}

const getSysadminCreated = async () => {
  return await getSharedEnclaveKey(constants.SYSADMIN_CREATED);
}
const setSorUserId = async (userId) => {
  return await setSharedEnclaveKey(constants.SOR_USER_ID, userId);
}

const getSorUserId = async () => {
  return await getSharedEnclaveKey(constants.SOR_USER_ID);
}

async function migrateData(sharedEnclave){
  let adminGroup = await getAdminGroup(sharedEnclave);
  const apiKeyClient = apiKeySpace.getAPIKeysClient();
  try {
    notificationHandler.reportUserRelevantInfo(`System Alert: Migration of Access Control Mechanisms is Currently Underway. Your Patience is Appreciated.`);
    let did = await getStoredDID();
    try {
      const sysadminSecret = await getBreakGlassRecoveryCode();
      const apiKey = crypto.sha256JOSE(crypto.generateRandom(32), "base64");
      const body = {
        secret: sysadminSecret,
        apiKey
      }
      await apiKeyClient.becomeSysAdmin(JSON.stringify(body));
      await setSysadminCreated(true);
    }catch (e) {
      console.log(e);
      // already sysadmin
    }
    let groupDIDDocument = await $$.promisify(w3cdid.resolveDID)(adminGroup.did);
    const members = await $$.promisify(groupDIDDocument.getMembers)();
    for (let member in members) {
      const memberObject = members[member];
      if (member !== did) {
        await apiKeyClient.makeSysAdmin(getUserIdFromUsername(memberObject.username), crypto.generateRandom(32).toString("base64"));
      }
    }
    const epiEnclaveRecord = await $$.promisify(sharedEnclave.readKey)(constants.EPI_SHARED_ENCLAVE);
    let enclaveKeySSI = epiEnclaveRecord.enclaveKeySSI;
    let response
    try {
      response = await fetch(`${window.location.origin}/doMigration`, {
        body: JSON.stringify({epiEnclaveKeySSI: enclaveKeySSI}),
        method: "PUT",
        headers: {"Content-Type": "application/json"}
      });
    }catch (e) {
      notificationHandler.reportUserRelevantError(`Failed to migrate Access Control Mechanisms.`);
      return;
    }
    if(response.status !== 200){
      console.log(response.statusText);
      notificationHandler.reportUserRelevantError(`Failed to migrate Access Control Mechanisms.`);
      return;
    }
  }catch (e) {
    console.log(e);
    notificationHandler.reportUserRelevantError(`Failed to migrate Access Control Mechanisms.`);
    return;
  }

  async function assignAccessToGroups(sharedEnclave) {
    await associateGroupAccess(sharedEnclave, constants.WRITE_ACCESS_MODE);
    await associateGroupAccess(sharedEnclave, constants.READ_ONLY_ACCESS_MODE);
  }

  await assignAccessToGroups(sharedEnclave);
}

async function doMigration(sharedEnclave, force = false) {
  function showMigrationDialog() {
    // Check if the dialog already exists
    let dialog = document.getElementById('migrationDialog');
    if (!dialog) {
      dialog = document.createElement('div');
      dialog.id = 'migrationDialog';
      dialog.style.position = 'fixed';
      dialog.style.left = '0';
      dialog.style.top = '0';
      dialog.style.width = '100%';
      dialog.style.height = '100%';
      dialog.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
      dialog.style.zIndex = '1000';
      dialog.style.display = 'flex';
      dialog.style.justifyContent = 'center';
      dialog.style.alignItems = 'center';
      dialog.style.color = 'black';
      dialog.innerHTML = '<div style="padding: 40px; background: #FFF;">Migration is in progress, please wait...</div>';
      document.body.appendChild(dialog);
    } else {
      dialog.style.display = 'flex';
    }
  }

  // Function to hide the migration dialog
  function hideMigrationDialog() {
    const dialog = document.getElementById('migrationDialog');
    if (dialog) {
      dialog.style.display = 'none';
    }
  }

  if (!sharedEnclave) {
    sharedEnclave = await $$.promisify(scAPI.getSharedEnclave)();
  }
  if(force){
    await migrateData(sharedEnclave);
  }
  let response = await fetch(`${window.location.origin}/getMigrationStatus`);
  if (response.status !== 200) {
    throw new Error(`Failed to check migration status. HTTP status: ${response.status}`);
  }

  let migrationStatus = await response.text();

  if (migrationStatus === constants.MIGRATION_STATUS.NOT_STARTED) {
    await migrateData(sharedEnclave);
  }

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  response = await fetch(`${window.location.origin}/getMigrationStatus`);
  if (response.status !== 200) {
    throw new Error(`Failed to check migration status. HTTP status: ${response.status}`);
  }

  migrationStatus = await response.text();

  if (migrationStatus === constants.MIGRATION_STATUS.IN_PROGRESS) {
    showMigrationDialog();
  }

  while (migrationStatus === constants.MIGRATION_STATUS.IN_PROGRESS) {
    await delay(10000);

    response = await fetch(`${window.location.origin}/getMigrationStatus`);
    if (response.status !== 200) {
      throw new Error(`Failed to recheck migration status. HTTP status: ${response.status}`);
    }
    migrationStatus = await response.text();

    if (migrationStatus === constants.MIGRATION_STATUS.COMPLETED) {
      hideMigrationDialog();
      notificationHandler.reportUserRelevantInfo(`Migration of Access Control Mechanisms successfully executed !`);
      return;
    }

    if (migrationStatus === constants.MIGRATION_STATUS.FAILED) {
      hideMigrationDialog();
      notificationHandler.reportUserRelevantError(`Failed to migrate Access Control Mechanisms.`);
      return;
    }
  }
}


function retryAsyncFunction(asyncFunction, maxTries, timeBetweenRetries, ...args) {
  return new Promise(async (resolve) => {
    let attempt = 0;
    while (attempt < maxTries) {
      try {
        const result = await asyncFunction(...args);
        resolve(result); // Successful execution, resolve the promise with the result
        return; // Exit the function
      } catch (error) {
        attempt++;
        if (attempt >= maxTries) {
           $$.forceTabRefresh();
        } else {
          await new Promise(resolve => setTimeout(resolve, timeBetweenRetries)); // Wait before the next retry
        }
      }
    }
  });
}

async function getBreakGlassRecoveryCode() {
  const sharedEnclave = await $$.promisify(scAPI.getSharedEnclave)();
  let keySSI = await sharedEnclave.getKeySSIAsync();
  if (typeof keySSI !== "string" && keySSI.getIdentifier) {
    keySSI = keySSI.getIdentifier();
  }
  return keySSI;
}

export default {
  autoAuthorization,
  promisify,
  getPKFromContent,
  sendGroupMessage,
  sendUserMessage,
  addSharedEnclaveToEnv,
  getManagedFeatures,
  fetchGroups,
  addLogMessage,
  uuidv4,
  isValidDID,
  waitForEnclave,
  removeSharedEnclaveFromEnv,
  getSharedEnclaveDataFromEnv,
  getAdminGroup,
  getGroupName,
  renderToast,
  readMappingEngineMessages,
  initSharedEnclave,
  setEpiEnclave,
  setWalletStatus,
  getWalletStatus,
  showTextLoader,
  hideTextLoader,
  getUserIdFromUsername,
  getWriteGroup,
  getReadGroup,
  associateGroupAccess,
  setSysadminCreated,
  getSysadminCreated,
  setSorUserId,
  getSorUserId,
  doMigration,
  retryAsyncFunction,
  getBreakGlassRecoveryCode
};
