import Message from "../utils/Message.js";
import constants from "../constants.js";
import utils from "../utils.js";

const promisify = utils.promisify;

class MessageProcessingService {
  constructor(identity) {
    const openDSU = require('opendsu');
    const dbAPI = openDSU.loadAPI('db');

    dbAPI.getMainEnclave((err, enclaveDB)=>{
      this.storageService = enclaveDB;
    });
    this.identity = identity;
  }

  async readMessage() {
    const w3cDID = require("opendsu").loadAPI("w3cdid");
    let didDocument;
    try {
      didDocument = await promisify(w3cDID.resolveDID)(this.identity.did);
    } catch (e) {
      return console.error("Failed to resolve did", this.identity.did, e);
    }

    let message;
    try {
      message = await promisify(didDocument.readMessage)();
    } catch (e) {
      return console.error("Failed to read message", e);
    }
    try {
      await this.parseMessageAndStoreMessage(message);
    } catch (e) {
      return console.error(e);
    }
    await this.readMessage();
  }

  async parseMessageAndStoreMessage(messageSerialisation) {
    const w3cDID = require("opendsu").loadAPI("w3cdid");

    const message = new Message(messageSerialisation);
    const senderDID = message.getSender();
    const content = message.getContent();
    const recipientType = message.getRecipientType();
    const operation = message.getOperation();
    let record;

    if (senderDID !== this.identity.did) {
      if (recipientType === constants.RECIPIENT_TYPES.GROUP_RECIPIENT) {
        const groupDID = message.getGroupDID();
        let groupDIDDocument;
        try {
          groupDIDDocument = await promisify(w3cDID.resolveDID)(groupDID);
        } catch (e) {
          return console.error(e);
        }

        let groupName = groupDIDDocument.getGroupName();

        switch (message.getContentType()) {
          case constants.CONTENT_TYPE.GROUP_MEMBER:
            record = { owner: senderDID, name: groupName, did: groupDID };
            await this.performTableOperation(operation, constants.TABLES.GROUPS, groupDID, record);
            return;
          case constants.CONTENT_TYPE.CREDENTIAL:
            record = { issuer: senderDID, did: groupDID, token: content };
            await this.performTableOperation(
              operation,
              constants.TABLES.GROUPS_CREDENTIALS,
              utils.getPKFromContent(content),
              record
            );
            return;
          case constants.CONTENT_TYPE.DATABASE:
            const { name, keySSI } = JSON.parse(content);
            record = { issuer: senderDID, did: groupDID, name, keySSI };
            await this.performTableOperation(operation, constants.TABLES.GROUP_ENCLAVES, keySSI, record);
            return;
          default:
            return console.error(`Invalid content type received ${message.getContentType()}`);
        }
      } else if (recipientType === constants.RECIPIENT_TYPES.USER_RECIPIENT) {
        switch (message.getContentType()) {
          case constants.CONTENT_TYPE.CREDENTIAL:
            record = {
              issuer: senderDID,
              token: content,
              member: this.identity.did,
            };
            await this.performTableOperation(
              operation,
              constants.TABLES.USER_CREDENTIALS,
              utils.getPKFromContent(content),
              record
            );
            return;
          case constants.CONTENT_TYPE.DATABASE:
            const { name, keySSI } = content;
            record = {
              owner: senderDID,
              name,
              keySSI,
              member: this.identity.did,
            };
            await this.performTableOperation(operation, constants.TABLES.USER_DATABASES, keySSI, record);
            return;
          default:
            return console.error("Invalid content type received");
        }
      } else {
        throw Error("Invalid recipient type");
      }
    }
  }

  async performTableOperation(operation, table, pk, record) {
    switch (operation) {
      case constants.OPERATIONS.ADD:
        return await this.storageService.insertRecordAsync(table, pk, record);
      case constants.OPERATIONS.REMOVE:
        return await this.storageService.deleteRecordAsync(table, pk);
      default:
        throw Error(`Invalid operation <${operation}>`);
    }
  }
}

export default function getMessageProcessingService(storageService, identity) {
  if (typeof window.messageProcessingServiceSingleton === "undefined") {
    window.messageProcessingServiceSingleton = new MessageProcessingService(storageService, identity);
  }

  return window.messageProcessingServiceSingleton;
}
