import {getCredentialService} from "../services/JWTCredentialService.js";
import constants from "../constants.js";
import utils from "../utils.js";

const promisify = utils.promisify;

function checkIfCreateGroupMessage(message) {
  return message.messageType === "CreateGroup";
}

async function createGroup(message) {
  const openDSU = require("opendsu");
  const w3cdid = openDSU.loadAPI("w3cdid");
  const scAPI = openDSU.loadAPI("sc");
  const enclaveDB = await $$.promisify(scAPI.getMainEnclave)();
  const didDomain = await promisify(scAPI.getDIDDomain)();


  const group = {};
  group.name = message.groupName;
  group.tags = message.groupTags;
  let enclaveName, accessMode;
  if (message.accessModes) {
    [enclaveName, accessMode] = message.accessModes.split(':');
    group.enclaveName = enclaveName;
    group.accessMode = accessMode;
  }

  let groupName = message.groupName.replaceAll(" ", "_");
  let groupDIDDocument;
  try {
    groupDIDDocument = await $$.promisify(w3cdid.resolveDID)(`did:ssi:group:${didDomain}:${groupName}`);
  } catch (e) {}
  if (typeof groupDIDDocument === "undefined") {
    groupDIDDocument = await promisify(w3cdid.createIdentity)("ssi:group", didDomain, groupName);
    group.did = groupDIDDocument.getIdentifier();

    const sharedEnclaveDB = await $$.promisify(scAPI.getSharedEnclave)();
    let batchId = await sharedEnclaveDB.startOrAttachBatchAsync();
    try {
      await sharedEnclaveDB.insertRecordAsync(constants.TABLES.GROUPS, group.did, group);

      const adminDID = await enclaveDB.readKeyAsync(constants.IDENTITY);
      const credentialService = getCredentialService();
      const groupCredential = await credentialService.createVerifiableCredential(adminDID.did, group.did);
      await sharedEnclaveDB.insertRecordAsync(constants.TABLES.GROUPS_CREDENTIALS, utils.getPKFromContent(groupCredential), {
        issuer: adminDID.did,
        groupDID: group.did,
        token: groupCredential,
        credentialType: constants.CREDENTIAL_TYPES.WALLET_AUTHORIZATION,
        encodingType: constants.JWT_ENCODING,
        tags: [group.name, constants.CREDENTIAL_TYPES.WALLET_AUTHORIZATION]
      });
    } catch (e) {
      try{
        await sharedEnclaveDB.cancelBatchAsync(batchId);
      }catch (err) {
        console.log(err);
      }

      throw e;
    }
    try{
      await sharedEnclaveDB.commitBatchAsync(batchId);
    }catch (e) {
      try{
        await sharedEnclaveDB.cancelBatchAsync(batchId);
      } catch (err) {
        console.log(err);
      }
    }
  }
}

require("opendsu").loadAPI("m2dsu").defineMapping(checkIfCreateGroupMessage, createGroup);
export { createGroup };
