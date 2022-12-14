import {getStoredDID, setStoredDID, setWalletStatus, getWalletStatus} from "../services/BootingIdentityService.js";
import constants from "../constants.js";
import utils from "../utils.js";
import MessagesService from "../services/MessagesService.js";

const {DwController} = WebCardinal.controllers;

const openDSU = require("opendsu");
const scAPI = openDSU.loadAPI("sc");
const w3cDID = openDSU.loadAPI("w3cdid");
const typicalBusinessLogicHub = w3cDID.getTypicalBusinessLogicHub();
class HomeController extends DwController {
  constructor(...props) {
    super(...props);

    this.model = {
      domain: this.domain, username: this.userDetails
    };

    const {ui} = this
    getWalletStatus().then(async status=>{
      if (status !== constants.ACCOUNT_STATUS.CREATED) {
        ui.disableMenu();
        this.model.showBootingIdentity = true;
        const isFirstAdmin = await this.isFirstAdmin();
          // const didWasCreated = await this.didWasCreated();
          const did = await $$.promisify(typicalBusinessLogicHub.mainDIDCreated)();
          if (isFirstAdmin) {
            if (did) {
              return;
            }

            this.createDID(async (err, model) => {
              const {didDocument, submitElement} = model;
              await $$.promisify(typicalBusinessLogicHub.setMainDID)(didDocument.getIdentifier());
              submitElement.loading = true;
              await this.createInitialDID();
              await this.showInitDialog();
              await this.createEnclaves();
              await this.createGroups();
              typicalBusinessLogicHub.subscribe(constants.MESSAGE_TYPES.ADD_MEMBER_TO_GROUP, this.onReceivedInitMessage.bind(this))
              await this.firstOrRecoveryAdminToAdministrationGroup(didDocument, this.userDetails);
            });
          } else {
            if (did) {
              await this.waitForApproval(did);
              return;
            }
            this.createDID(async (err, model) => {
              const {didDocument, submitElement} = model;
              submitElement.loading = true;
              await $$.promisify(typicalBusinessLogicHub.setMainDID)(didDocument.getIdentifier());
              await this.waitForApproval(didDocument);
              submitElement.loading = false;
            });
          }
      } else {
        this.showQuickActions();
      }
    }).catch(async e => {
      await ui.showToast("Error on getting wallet status: " + e.message);
    });
  }

  onReceivedInitMessage (message) {
    this.ui.hideDialogFromComponent("dw-dialog-initialising").then( () => {
      setWalletStatus(constants.ACCOUNT_STATUS.CREATED).then(()=>{
        this.ui.showDialogFromComponent("dw-dialog-break-glass-recovery", {
          sharedEnclaveKeySSI: this.keySSI,
        }, {
          parentElement: this.element, disableClosing: false, onClose: () => {
            this.showQuickActions();
          }
        }).then(()=>{
          console.log("Finished processing message", message);
        })
      })
    })
    // submitElement.loading = false;

  }

  onAccessGranted(message){
      utils.addSharedEnclaveToEnv(message.enclave.enclaveType, message.enclave.enclaveDID, message.enclave.enclaveKeySSI)
          .then( ()=>{
        this.ui.hideDialogFromComponent("dw-dialog-waiting-approval")
            .then(()=>{
              setWalletStatus(constants.ACCOUNT_STATUS.CREATED)
                  .then(() => this.showQuickActions());
            })
      })
  }

  showQuickActions() {
    this.model.showBootingIdentity = false;
    this.ui.enableMenu();
    this.resolveNavigation().then((enableGovernance) => {
      if (enableGovernance) {
        const governanceElement = this.querySelector("dw-action[tag='governance']");
        if (governanceElement) {
          governanceElement.removeAttribute("hidden");
        }
      }
      const actionElements = this.querySelectorAll("dw-action[tag]:not([hidden])");
      Array.from(actionElements).forEach((actionElement) => {
        actionElement.addEventListener("click", () => {
          this.navigateToPageTag(actionElement.getAttribute("tag"));
        });
      });
    });
    this.onTagClick("configuration.show", async () => {
      await UI.showConfigurationDialog(this.element);
    });


    this.getSharedEnclave().then(async (sharedEnclave) => {
      let adminGroup = await this.getAdminGroup(sharedEnclave);
      await utils.addLogMessage(this.did, constants.OPERATIONS.LOGIN, adminGroup.name, this.userName);
    }).catch(e => console.log("Could not log user login action ", e));

  }

  async getAdminGroup(sharedEnclave) {
    let groups = [];
    try {
      groups = await utils.promisify(sharedEnclave.filter)(constants.TABLES.GROUPS);
    } catch (e) {
      console.log(e);
    }
    let adminGroup = groups.find((gr) => gr.accessMode === constants.ADMIN_ACCESS_MODE || gr.name === constants.EPI_ADMIN_GROUP_NAME) || {};

    return adminGroup;
  }

  async resolveNavigation() {

    const {getEnvironmentDataAsync} = await import("../hooks/getEnvironmentData.js");
    const envData = await getEnvironmentDataAsync() || {};
    const enableGovernance = envData.enableGovernance || false;
    return enableGovernance;

  }

  async showInitDialog(did) {
    if (typeof did === "object") {
      did = did.getIdentifier();
    }
    await this.ui.showDialogFromComponent("dw-dialog-initialising", {did}, {
      parentElement: this.element, disableClosing: true,
    });
  }

  async waitForApproval(did) {
    if (typeof did !== "string") {
      did = did.getIdentifier();
    }
    this.did = did;
    typicalBusinessLogicHub.subscribe(constants.MESSAGE_TYPES.ADD_MEMBER_TO_GROUP, this.onAccessGranted.bind(this));
    await this.ui.showDialogFromComponent("dw-dialog-waiting-approval", {
      did: did,
    }, {
      parentElement: this.element, disableClosing: true
    });

    this.onTagClick("continue", async (model, target, event) => {
      try {
        const recoveryCode = document.getElementById("add-member-input").value;
        if (recoveryCode === "") {
          this.ui.showToast(`Please insert a recovery code.`);
          return;
        }

        target.loading = true;
        await this.setSharedEnclaveKeySSI(recoveryCode);
        let sharedEnclave = await this.getSharedEnclave();
        this.keySSI = await this.getSharedEnclaveKeySSI(sharedEnclave);
        await this.storeDID(this.did);
        await this.firstOrRecoveryAdminToAdministrationGroup(this.did, this.userDetails, constants.OPERATIONS.BREAK_GLASS_RECOVERY);
        target.loading = false;
      } catch (e) {
        console.log("Error on getting wallet with recovery code", e)
        this.ui.showToast("Couldn't recover wallet for inserted recovery code.");
        target.loading = false;
      }
    })
  }

  async setSharedEnclaveKeySSI(recoveryCode) {
    return new Promise((resolve, reject) => {
      const openDSU = require("opendsu");
      const scAPI = openDSU.loadAPI("sc");
      const keySSI = openDSU.loadAPI("keyssi");
      const enclaveAPI = openDSU.loadAPI("enclave");
      try {
        keySSI.parse(recoveryCode); // parse and check if the recoveryCode has the right format for a sharedEnclaveKeySSI
        const sharedEnclave = enclaveAPI.initialiseWalletDBEnclave(recoveryCode);
        sharedEnclave.on("error", err => {
          return reject(err);
        });
        sharedEnclave.on("initialised", async () => {
          await $$.promisify(scAPI.setSharedEnclave)(sharedEnclave);
          return resolve();
        });
      } catch (err) {
        return reject(err);
      }
    });
  }

  async storeDID(did) {
    await setStoredDID(did, this.model.username);
  }

  async didWasCreated() {
    let didRecord;
    try {
      didRecord = await getStoredDID();
    } catch (e) {

    }

    if (typeof didRecord === "undefined") {
      return false;
    }

    return true;
  }

  createDID(callback) {
    this.onTagEvent("did-component", "did-generate", async (model) => {
      await this.storeDID(model.didDocument);
      callback(undefined, model);
    });
  }

  async getDIDDomain() {
    if (!this.didDomain) {
      this.didDomain = await $$.promisify(scAPI.getDIDDomain)();
    }

    return this.didDomain;
  }

  async getMainEnclave() {
    if (!this.mainEnclave) {
      this.mainEnclave = await $$.promisify(scAPI.getMainEnclave)();
    }

    return this.mainEnclave;
  }

  async getSharedEnclave() {
    if (!this.sharedEnclave) {
      this.sharedEnclave = await $$.promisify(scAPI.getSharedEnclave)();
    }

    return this.sharedEnclave;
  }

  async isFirstAdmin() {
    const didDomain = await this.getDIDDomain();
    try {
      await $$.promisify(w3cDID.resolveDID)(`did:${constants.SSI_NAME_DID_TYPE}:${didDomain}:${constants.INITIAL_IDENTITY_PUBLIC_NAME}`);
    } catch (e) {
      return true;
    }

    return false;
  }

  async createInitialDID() {
    const didDomain = await this.getDIDDomain();
    await $$.promisify(w3cDID.createIdentity)(constants.SSI_NAME_DID_TYPE, didDomain, constants.INITIAL_IDENTITY_PUBLIC_NAME);
  }

  async createGroups() {
    const sharedEnclave = await this.getSharedEnclave();
    const messages = await $$.promisify(this.DSUStorage.getObject.bind(this.DSUStorage))(constants.GROUP_MESSAGES_PATH);
    await this.processMessages(sharedEnclave, messages);
  }

  async createEnclaves() {
    const mainEnclave = await this.getMainEnclave();
    const messages = await $$.promisify(this.DSUStorage.getObject.bind(this.DSUStorage))(constants.ENCLAVE_MESSAGES_PATH);
    await this.processMessages(mainEnclave, messages);
    console.log("Processed create enclave messages");
    const enclaveRecord = await mainEnclave.readKeyAsync(constants.SHARED_ENCLAVE);
    await $$.promisify(typicalBusinessLogicHub.setSharedEnclave)(enclaveRecord.enclaveKeySSI);
    await utils.addSharedEnclaveToEnv(enclaveRecord.enclaveType, enclaveRecord.enclaveDID, enclaveRecord.enclaveKeySSI);
    await this.storeSharedEnclaves();
  }

  async storeSharedEnclaves() {
    const mainEnclave = await this.getMainEnclave();
    const enclaves = await $$.promisify(mainEnclave.getAllRecords)(constants.TABLES.GROUP_ENCLAVES);
    const sharedEnclave = await this.getSharedEnclave();

    for (let i = 0; i < enclaves.length; i++) {
      await sharedEnclave.writeKeyAsync(enclaves[i].enclaveName, enclaves[i]);
      await sharedEnclave.insertRecordAsync(constants.TABLES.GROUP_ENCLAVES, enclaves[i].enclaveDID, enclaves[i]);
    }
    this.keySSI = await this.getSharedEnclaveKeySSI(sharedEnclave);

  }

  async getSharedEnclaveKeySSI(sharedEnclave) {
    let keySSI = await sharedEnclave.getKeySSIAsync();
    if (typeof keySSI !== "string" && keySSI.getIdentifier) {
      keySSI = keySSI.getIdentifier();
    }
    return keySSI;
  }

  async firstOrRecoveryAdminToAdministrationGroup(did, userDetails, logAction = constants.OPERATIONS.SHARED_ENCLAVE_CREATE) {
    if (typeof did !== "string") {
      did = did.getIdentifier();
    }
    const sharedEnclave = await this.getSharedEnclave();
    let adminGroup = await this.getAdminGroup(sharedEnclave);
    const addMemberToGroupMessage = {
      messageType: "AddMemberToGroup",
      groupDID: adminGroup.did,
      enclaveName: adminGroup.enclaveName,
      memberDID: did,
      memberName: userDetails
    };
    this.did = did;
    await utils.addLogMessage(did, logAction, adminGroup.name, this.userName || "-");

    await this.processMessages(sharedEnclave, addMemberToGroupMessage);
  }

  async processMessages(storageService, messages) {
    if (!messages) {
      return
    }
    if (!Array.isArray(messages)) {
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

const UI = {
  showConfigurationDialog: async (container) => {
    const dialogElement = document.createElement("dw-dialog-configuration");
    dialogElement.setAttribute("controller", "ConfigurationController");
    container.append(dialogElement);
    await dialogElement.componentOnReady();

    const slElement = dialogElement.querySelector("sl-dialog");
    setTimeout(() => {
      slElement.show();
    }, 25);

    slElement.addEventListener("sl-hide", () => {
      dialogElement.remove();
    });
  },
};
export default HomeController;
