import constants from "../constants.js";

const {DwController} = WebCardinal.controllers;
import MessagesService from "../services/MessagesService.js";
import {getCommunicationService} from "../services/CommunicationService.js";
import utils from "../utils.js";
import {setStoredDID, getStoredDID, getWalletStatus} from "../services/BootingIdentityService.js";

const openDSU = require("opendsu");
const scAPI = openDSU.loadAPI("sc");
const w3cDID = openDSU.loadAPI("w3cdid");

class BootingIdentityController extends DwController {
  constructor(...props) {
    super(...props);
    const {ui} = this;
    ui.disableMenu();

    console.log("BootingIdentityController");

    this.model = {
      domain: this.domain,
      username: this.userDetails
    };

    this.isFirstAdmin().then(async isFirstAdmin => {
      if (isFirstAdmin) {
        const didWasCreated = await this.didWasCreated();
        if (didWasCreated) {
          this.history.go("quick-actions");
          return;
        }

        this.createDID(async (err, model) => {
          const {didDocument, submitElement} = model;
          submitElement.loading = true;
          await this.createInitialDID();
          await this.showInitDialog();
          await this.createEnclaves();
          await this.createGroups();
          await this.addFirstAdminToAdministrationGroup(didDocument, this.userDetails);
          submitElement.loading = false;
          getCommunicationService().waitForMessage(didDocument, async () => {
            this.ui.enableMenu();
            this.history.go("quick-actions");
          })
        });
      } else {
        const didWasCreated = await this.didWasCreated();
        if (didWasCreated) {
          const did = await getStoredDID();
          await this.waitForApproval(did);
          return;
        }

        this.createDID(async (err, model) => {
          const {didDocument, submitElement} = model;
          submitElement.loading = true;
          await this.waitForApproval(didDocument);
          submitElement.loading = false;
        });
      }
    }).catch(async e => {
      await ui.showToast("Error on getting wallet status: " + e.message);
    });
  }

  async showInitDialog(did){
    if (typeof did === "object") {
      did = did.getIdentifier();
    }
    await this.ui.showDialogFromComponent("dw-dialog-initialising", {did},
        {
          parentElement: this.element,
          disableClosing: true,
        });
  }

  async waitForApproval(did) {
    if (typeof did !== "string") {
      did = did.getIdentifier();
    }
    getCommunicationService().waitForMessage(did, async () => {
      this.ui.enableMenu();
      this.history.go("quick-actions");
    });
    await this.ui.showDialogFromComponent(
      "dw-dialog-waiting-approval",
      {
        did: did,
      },
      {
        parentElement: this.element,
        disableClosing: true,
      }
    );
  }

  async storeDID(did){
    await setStoredDID(did, this.model.username);
  }

  async didWasCreated(){
    let didRecord;
    try {
      didRecord = await getStoredDID();
    }catch (e) {

    }

    if (typeof didRecord === "undefined") {
      return false;
    }

    return true;
  }

  createDID(callback){
    this.onTagEvent("did-component", "did-generate", async (model) => {
      await this.storeDID(model.didDocument);
      callback(undefined, model);
    });
  }

  async getDIDDomain(){
    if(!this.didDomain){
      this.didDomain = await $$.promisify(scAPI.getDIDDomain)();
    }

    return this.didDomain;
  }

  async getMainEnclave(){
    if (!this.mainEnclave) {
      this.mainEnclave = await $$.promisify(scAPI.getMainEnclave)();
    }

    return this.mainEnclave;
  }

  async getSharedEnclave(){
    if (!this.sharedEnclave) {
      this.sharedEnclave = await $$.promisify(scAPI.getSharedEnclave)();
    }

    return this.sharedEnclave;
  }

  async isFirstAdmin(){
    const didDomain = await this.getDIDDomain();
    try {
      await $$.promisify(w3cDID.resolveDID)(`did:${constants.SSI_NAME_DID_TYPE}:${didDomain}:${constants.INITIAL_IDENTITY_PUBLIC_NAME}`);
    } catch (e) {
      return true;
    }

    return false;
  }

  async createInitialDID(){
    const didDomain = await this.getDIDDomain();
    await $$.promisify(w3cDID.createIdentity)(constants.SSI_NAME_DID_TYPE, didDomain, constants.INITIAL_IDENTITY_PUBLIC_NAME);
  }

  async createGroups(){
    const sharedEnclave = await this.getSharedEnclave();
    const messages = await $$.promisify(this.DSUStorage.getObject.bind(this.DSUStorage))(constants.GROUP_MESSAGES_PATH);
    await this.processMessages(sharedEnclave, messages);
  }

  async createEnclaves(){
    const mainEnclave = await this.getMainEnclave();
    const messages = await $$.promisify(this.DSUStorage.getObject.bind(this.DSUStorage))(constants.ENCLAVE_MESSAGES_PATH);
    await this.processMessages(mainEnclave, messages);
    console.log("Processed create enclave messages");
    const enclaveRecord = await mainEnclave.readKeyAsync(constants.SHARED_ENCLAVE);
    await utils.addSharedEnclaveToEnv(enclaveRecord.enclaveType, enclaveRecord.enclaveDID, enclaveRecord.enclaveKeySSI);
    await this.storeSharedEnclaves();
  }

  async storeSharedEnclaves(){
    const mainEnclave = await this.getMainEnclave();
    const enclaves = await $$.promisify(mainEnclave.getAllRecords)(constants.TABLES.GROUP_ENCLAVES);
    const sharedEnclave = await this.getSharedEnclave();

    for (let i = 0; i < enclaves.length; i++) {
      await sharedEnclave.writeKeyAsync(enclaves[i].enclaveName, enclaves[i]);
      await sharedEnclave.insertRecordAsync(constants.TABLES.GROUP_ENCLAVES, enclaves[i].enclaveDID, enclaves[i]);
    }
  }

  async addFirstAdminToAdministrationGroup(did, userDetails){
    if (typeof did !== "string") {
      did = did.getIdentifier();
    }
    const sharedEnclave = await this.getSharedEnclave();
    let groups = [];
    try {
      groups = await utils.promisify(sharedEnclave.filter)(constants.TABLES.GROUPS);
    } catch (e) {
      console.log(e);
    }
    let adminGroup = groups.find((gr) => gr.accessMode === constants.ADMIN_ACCESS_MODE || gr.name === "ePI Administration Group") || {};
    this.groupName = adminGroup.name;
    const addMemberToGroupMessage = {
      messageType: "AddMemberToGroup",
      groupDID: adminGroup.did,
      enclaveName: adminGroup.enclaveName,
      memberDID: did,
      memberName: userDetails
    };
    await this.processMessages(sharedEnclave, addMemberToGroupMessage);
  }

  async processMessages(storageService, messages) {
    if (!messages) {
      return
    }
    if(!Array.isArray(messages)){
      messages = [messages];
    }
    try {
      await MessagesService.processMessages(storageService, messages, (undigestedMessages) => {
        if (undigestedMessages && undigestedMessages.length > 0) {
          console.log("Couldn't process all messages. Undigested messages: ", undigestedMessages);
        }
      })
    } catch (err) {
      console.log("Couldn't process messages: ", err, messages);
    }
  }
}

export default BootingIdentityController;
