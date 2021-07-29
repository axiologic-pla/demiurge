export default class Message {
  constructor(serialisation) {
    this.message = {};
    if (typeof serialisation !== "undefined") {
      try {
        this.message = JSON.parse(serialisation);
      } catch (e) {
        throw createOpenDSUErrorWrapper(`Invalid message serialisation ${serialisation}`, e);
      }
    }
  }

  setGroupDID(_teamDID) {
    this.message.groupDID = _teamDID;
  }

  getGroupDID() {
    return this.message.groupDID;
  }

  setContent(content) {
    this.message.content = content;
  }

  getContent() {
    return this.message.content;
  }

  setContentType(_type) {
    this.message.contentType = _type;
  }

  getContentType() {
    return this.message.contentType;
  }

  setRecipientType(_recipientType) {
    this.message.recipientType = _recipientType;
  }

  getRecipientType() {
    return this.message.recipientType;
  }

  setOperation(_operation) {
    this.message.operation = _operation;
  }

  getOperation() {
    return this.message.operation;
  }

  setSender(senderDID) {
    this.message.sender = senderDID;
  }

  getSender() {
    return this.message.sender;
  }

  getSerialisation() {
    return JSON.stringify(this.message);
  }
}
