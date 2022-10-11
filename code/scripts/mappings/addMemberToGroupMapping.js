import {getCredentialService} from "../services/JWTCredentialService.js";
import constants from "../constants.js";
import utils from "../utils.js";

const promisify = utils.promisify;

function checkIfAddMemberToGroupMessage(message) {
  return message.messageType === "AddMemberToGroup";
}

async function addMemberToGroupMapping(message) {
  const openDSU = require("opendsu");
  const w3cdid = openDSU.loadAPI("w3cdid");
  const scAPI = openDSU.loadAPI("sc");
  const crypto = openDSU.loadAPI("crypto");
  const mainDSU = await $$.promisify(scAPI.getMainDSU)();
  await $$.promisify(mainDSU.refresh)();
  const mainEnclave = await $$.promisify(scAPI.getMainEnclave)();
  const sharedEnclave = await $$.promisify(scAPI.getSharedEnclave)();
  const vaultDomain = await promisify(scAPI.getVaultDomain)();
  const dsu = await this.createDSU(vaultDomain, "seed");

  const member = {
    username: message.memberName,
    did: message.memberDID,
  };
  const groupDIDDocument = await promisify(w3cdid.resolveDID)(message.groupDID);
  await promisify(groupDIDDocument.addMember)(member.did, member);
  let adminDID = await mainEnclave.readKeyAsync(constants.IDENTITY);
  adminDID = adminDID.did;
  const adminDID_Document = await $$.promisify(w3cdid.resolveDID)(adminDID);
  const memberDID_Document = await $$.promisify(w3cdid.resolveDID)(member.did);

  // ePI backward compatibility
  const enclaveName = message.enclaveName || constants.EPI_SHARED_ENCLAVE;
  let enclave = await sharedEnclave.readKeyAsync(enclaveName);
  const enclaveRecord = {
    enclaveType: enclave.enclaveType,
    enclaveDID: enclave.enclaveDID,
    enclaveKeySSI: enclave.enclaveKeySSI
  };

  // ePI backward compatibility
  if (message.accessMode === constants.READ_ONLY_ACCESS_MODE || groupDIDDocument.getGroupName() === constants.EPI_READ_GROUP) {
    const keySSISpace = openDSU.loadAPI('keyssi');
    if (typeof enclaveRecord.enclaveKeySSI === 'string') {
      enclaveRecord.enclaveKeySSI = keySSISpace.parse(enclaveRecord.enclaveKeySSI);
      enclaveRecord.enclaveKeySSI = await $$.promisify(enclaveRecord.enclaveKeySSI.derive)();
      enclaveRecord.enclaveKeySSI = enclaveRecord.enclaveKeySSI.getIdentifier();
    }
  }

  const credentials = await sharedEnclave.filterAsync(constants.TABLES.GROUPS_CREDENTIALS, `groupDID == ${message.groupDID}`);
  let groupCredential = credentials.find(el => el.credentialType === constants.CREDENTIAL_TYPES.WALLET_AUTHORIZATION);

  if (!groupCredential) {
    const credentialService = getCredentialService();
    const groupCredential = await credentialService.createVerifiableCredential(adminDID, message.groupDID);
    await sharedEnclave.insertRecordAsync(constants.TABLES.GROUPS_CREDENTIALS, utils.getPKFromCredential(groupCredential), {
      issuer: adminDID,
      groupDID: message.groupDID,
      token: groupCredential,
      credentialType: constants.CREDENTIAL_TYPES.WALLET_AUTHORIZATION,
      encodingType: constants.JWT_ENCODING,
      tags: [groupDIDDocument.getGroupName(), constants.CREDENTIAL_TYPES.WALLET_AUTHORIZATION]
    });
  }

  const msg = {
    messageType: "AddMemberToGroup",
    credential: groupCredential,
    enclave: enclaveRecord,
  };

  await $$.promisify(adminDID_Document.sendMessage)(JSON.stringify(msg), memberDID_Document);
}

require("opendsu").loadAPI("m2dsu").defineMapping(checkIfAddMemberToGroupMessage, addMemberToGroupMapping);
export { addMemberToGroupMapping };
