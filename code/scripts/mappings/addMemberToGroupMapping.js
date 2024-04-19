import {getCredentialService} from "../services/JWTCredentialService.js";
import constants from "../constants.js";
import utils from "../utils.js";
import {getGroupCredential} from "./utils.js";

const promisify = utils.promisify;

function checkIfAddMemberToGroupMessage(message) {
  return message.messageType === constants.MESSAGE_TYPES.ADD_MEMBER_TO_GROUP;
}

async function addMemberToGroupMapping(message) {
  const openDSU = require("opendsu");
  const w3cdid = openDSU.loadAPI("w3cdid");
  const scAPI = openDSU.loadAPI("sc");
  const crypto = openDSU.loadAPI("crypto");
  const apiKeyAPI = openDSU.loadAPI("apiKey");
  const apiKeyClient = apiKeyAPI.getAPIKeysClient();
  const mainDSU = await $$.promisify(scAPI.getMainDSU)();
  await $$.promisify(mainDSU.refresh)();
  const mainEnclave = await $$.promisify(scAPI.getMainEnclave)();
  const sharedEnclave = await $$.promisify(scAPI.getSharedEnclave)();
  const member = {
    username: message.memberName,
    did: message.memberDID,
  };

  const groupDIDDocument = await promisify(w3cdid.resolveDID)(message.groupDID);
  let adminDID = await mainEnclave.readKeyAsync(constants.IDENTITY);
  adminDID = adminDID.did;

  const enclaveName = message.enclaveName;
  let enclave = await sharedEnclave.readKeyAsync(enclaveName);
  const enclaveRecord = {
    enclaveType: enclave.enclaveType,
    enclaveDID: enclave.enclaveDID,
    enclaveKeySSI: enclave.enclaveKeySSI
  };

  /*
  *** allow access to enclave to let read only user to audit login

    if (message.accessMode === constants.READ_ONLY_ACCESS_MODE) {
      const keySSISpace = openDSU.loadAPI('keyssi');
      if (typeof enclaveRecord.enclaveKeySSI === 'string') {
        enclaveRecord.enclaveKeySSI = keySSISpace.parse(enclaveRecord.enclaveKeySSI);
        enclaveRecord.enclaveKeySSI = await $$.promisify(enclaveRecord.enclaveKeySSI.derive)();
        enclaveRecord.enclaveKeySSI = enclaveRecord.enclaveKeySSI.getIdentifier();
      }
    }
  */

  let groupCredential = await getGroupCredential(message.groupDID);

  if (!groupCredential) {
    const credentialService = getCredentialService();
    const groupCredential = await credentialService.createVerifiableCredential(adminDID, message.groupDID);

    await sharedEnclave.insertRecordAsync(constants.TABLES.GROUPS_CREDENTIALS, utils.getPKFromContent(groupCredential), {
      issuer: adminDID,
      groupDID: message.groupDID,
      token: groupCredential,
      credentialType: constants.CREDENTIAL_TYPES.WALLET_AUTHORIZATION,
      encodingType: constants.JWT_ENCODING,
      tags: [groupDIDDocument.getGroupName(), constants.CREDENTIAL_TYPES.WALLET_AUTHORIZATION]
    });
  }

  let allPossibleGroups =  await sharedEnclave.filterAsync(constants.TABLES.GROUPS, "enclaveName == epiEnclave");
  groupCredential.allPossibleGroups = allPossibleGroups;

  if(message.accessMode === constants.ADMIN_ACCESS_MODE) {
    const _becomeSysAdmin = async () => {
      const sysadminSecret = await utils.getBreakGlassRecoveryCode();
      const apiKey = await crypto.sha256JOSE(crypto.generateRandom(32), "base64");
      const body = {
        secret: sysadminSecret,
        apiKey: apiKey
      };
      await apiKeyClient.becomeSysAdmin(JSON.stringify(body));
      await utils.setSysadminCreated(true);
    }
    const sysadminExists = await utils.getSysadminCreated();
    if(!sysadminExists) {
      await _becomeSysAdmin();
    } else {
      try{
        await apiKeyClient.makeSysAdmin(utils.getUserIdFromUsername(member.username), crypto.sha256JOSE(crypto.generateRandom(32), "base64"));
      }catch (e) {
        await _becomeSysAdmin();
      }
    }
  } else {
    const apiKey = {
      secret: crypto.sha256JOSE(crypto.generateRandom(32), "base64"),
      scope: message.accessMode
    }
    await apiKeyClient.associateAPIKey(constants.APPS.DSU_FABRIC, constants.API_KEY_NAME, utils.getUserIdFromUsername(member.username), JSON.stringify(apiKey));
  }
  await promisify(groupDIDDocument.addMember)(member.did, member);
  let secretsHandler = await this.getSecretsHandler(adminDID);
  await secretsHandler.authorizeUser(member.did, groupCredential, enclave);
}

const m2dsu = require("opendsu").loadAPI("m2dsu");
const w3cdid = require("opendsu").loadAPI("w3cdid");
//loading SecretsHandler apis
try{
  m2dsu.defineApi("getSecretsHandler", w3cdid.SecretsHandler.getInstance);
}catch(err){
  console.log(err);
}
//defining mapping
m2dsu.defineMapping(checkIfAddMemberToGroupMessage, addMemberToGroupMapping);
export {addMemberToGroupMapping};
