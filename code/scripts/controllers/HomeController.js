import {getStoredDID, setStoredDID, setWalletStatus, getWalletStatus} from "../services/BootingIdentityService.js";
import constants from "../constants.js";
import utils from "../utils.js";
import MessagesService from "../services/MessagesService.js";

const {DwController} = WebCardinal.controllers;

const openDSU = require("opendsu");
const scAPI = openDSU.loadAPI("sc");
const w3cDID = openDSU.loadAPI("w3cdid");
const typicalBusinessLogicHub = w3cDID.getTypicalBusinessLogicHub();
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

function HomeController(...props) {
  let self = new DwController(...props);
  self.model = {
    domain: self.domain, username: self.userDetails
  };

  const {ui} = self
  getWalletStatus().then(async status=>{
    if (status !== constants.ACCOUNT_STATUS.CREATED) {
      ui.disableMenu();
      self.model.showBootingIdentity = true;
      const isFirstAdmin = await self.isFirstAdmin();
      // const didWasCreated = await seshowDialogFromComponentlf.didWasCreated();
      const did = await $$.promisify(typicalBusinessLogicHub.mainDIDCreated)();
      if (isFirstAdmin) {
        if (did) {
          return;
        }

        self.createDID(async (err, model) => {
          const {didDocument, submitElement} = model;
          await $$.promisify(typicalBusinessLogicHub.setMainDID)(didDocument.getIdentifier());
          submitElement.loading = true;
          await self.createInitialDID();
          await self.showInitDialog();
          await self.createEnclaves();
          await self.createGroups();
          typicalBusinessLogicHub.subscribe(constants.MESSAGE_TYPES.ADD_MEMBER_TO_GROUP, self.onReceivedInitMessage)
          await self.firstOrRecoveryAdminToAdministrationGroup(didDocument, self.userDetails);
        });
      } else {
        if (did) {
          await self.waitForApproval(did);
          return;
        }
        self.createDID(async (err, model) => {
          const {didDocument, submitElement} = model;
          submitElement.loading = true;
          await $$.promisify(typicalBusinessLogicHub.setMainDID)(didDocument.getIdentifier());
          await self.waitForApproval(didDocument);
          submitElement.loading = false;
        });
      }
    } else {
      let did;
      try {
        did = await getStoredDID();
      } catch (err) {}
      if (did) {
        await $$.promisify(typicalBusinessLogicHub.setMainDID)(did);
      }
      self.showQuickActions();
    }
  }).catch(async e => {
    await ui.showToast("Error on getting wallet status: " + e.message);
  });

  self.onReceivedInitMessage = (message) => {
    self.ui.hideDialogFromComponent("dw-dialog-initialising").then(() => {
      setWalletStatus(constants.ACCOUNT_STATUS.CREATED).then(() => {
        self.ui.showDialogFromComponent("dw-dialog-break-glass-recovery", {
          sharedEnclaveKeySSI: self.keySSI,
        }, {
          parentElement: self.element, disableClosing: false, onClose: () => {
            self.showQuickActions();
          }
        }).then(() => {
          console.log("Finished processing message", message);
        })
      })
    }).catch(console.log);
    // submitElement.loading = false;

  }
  self.onAccessGranted = (message)=>{
    utils.addSharedEnclaveToEnv(message.enclave.enclaveType, message.enclave.enclaveDID, message.enclave.enclaveKeySSI)
        .then(()=> {
          self.ui.hideDialogFromComponent("dw-dialog-waiting-approval")
              .then(()=>{
                setWalletStatus(constants.ACCOUNT_STATUS.CREATED)
                    .then(() => self.showQuickActions());
              })
        }).catch(console.log)
  }

  self.showQuickActions = () => {
    self.model.showBootingIdentity = false;
    self.ui.enableMenu();
    self.resolveNavigation().then((enableGovernance) => {
      if (enableGovernance) {
        const governanceElement = self.querySelector("dw-action[tag='governance']");
        if (governanceElement) {
          governanceElement.removeAttribute("hidden");
        }
      }
      const actionElements = self.querySelectorAll("dw-action[tag]:not([hidden])");
      Array.from(actionElements).forEach((actionElement) => {
        actionElement.addEventListener("click", () => {
          self.navigateToPageTag(actionElement.getAttribute("tag"));
        });
      });
    });
    self.onTagClick("configuration.show", async () => {
      await UI.showConfigurationDialog(self.element);
    });


    self.getSharedEnclave().then(async (sharedEnclave) => {
      let adminGroup = await self.getAdminGroup(sharedEnclave);
      await utils.addLogMessage(self.did, constants.OPERATIONS.LOGIN, adminGroup.name, self.userName);
    }).catch(e => console.log("Could not log user login action ", e));

  }

  self.getAdminGroup = async (sharedEnclave) => {
    let groups = [];
    try {
      groups = await utils.promisify(sharedEnclave.filter)(constants.TABLES.GROUPS);
    } catch (e) {
      console.log(e);
    }
    let adminGroup = groups.find((gr) => gr.accessMode === constants.ADMIN_ACCESS_MODE || gr.name === constants.EPI_ADMIN_GROUP_NAME) || {};

    return adminGroup;
  }

  self.resolveNavigation = async () => {

    const {getEnvironmentDataAsync} = await import("../hooks/getEnvironmentData.js");
    const envData = await getEnvironmentDataAsync() || {};
    const enableGovernance = envData.enableGovernance || false;
    return enableGovernance;

  }

  self.showInitDialog = async (did) => {
    if (typeof did === "object") {
      did = did.getIdentifier();
    }
    await self.ui.showDialogFromComponent("dw-dialog-initialising", {did}, {
      parentElement: self.element, disableClosing: true,
    });
  }

  self.waitForApproval = async (did) => {
    if (typeof did !== "string") {
      did = did.getIdentifier();
    }
    self.did = did;
    typicalBusinessLogicHub.subscribe(constants.MESSAGE_TYPES.ADD_MEMBER_TO_GROUP, self.onAccessGranted);
    await self.ui.showDialogFromComponent("dw-dialog-waiting-approval", {
      did: did,
    }, {
      parentElement: self.element, disableClosing: true
    });

    self.onTagClick("continue", async (model, target, event) => {
      try {
        const recoveryCode = document.getElementById("add-member-input").value;
        if (recoveryCode === "") {
          self.ui.showToast(`Please insert a recovery code.`);
          return;
        }

        target.loading = true;
        await self.setSharedEnclaveKeySSI(recoveryCode);
        let sharedEnclave = await self.getSharedEnclave();
        self.keySSI = await self.getSharedEnclaveKeySSI(sharedEnclave);
        await self.storeDID(self.did);
        await self.firstOrRecoveryAdminToAdministrationGroup(self.did, self.userDetails, constants.OPERATIONS.BREAK_GLASS_RECOVERY);
        target.loading = false;
      } catch (e) {
        console.log("Error on getting wallet with recovery code", e)
        self.ui.showToast("Couldn't recover wallet for inserted recovery code.");
        target.loading = false;
      }
    })
  }

  self.setSharedEnclaveKeySSI = async (recoveryCode) => {
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

  self.storeDID = async (did) => {
    await setStoredDID(did, self.model.username);
  }

  self.didWasCreated = async () => {
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

  self.createDID = async (callback) => {
    self.onTagEvent("did-component", "did-generate", async (model) => {
      await self.storeDID(model.didDocument);
      callback(undefined, model);
    });
  }

  self.getDIDDomain = async () => {
    if (!self.didDomain) {
      self.didDomain = await $$.promisify(scAPI.getDIDDomain)();
    }

    return self.didDomain;
  }

  self.getMainEnclave = async () => {
    if (!self.mainEnclave) {
      self.mainEnclave = await $$.promisify(scAPI.getMainEnclave)();
    }

    return self.mainEnclave;
  }

  self.getSharedEnclave = async () => {
    if (!self.sharedEnclave) {
      self.sharedEnclave = await $$.promisify(scAPI.getSharedEnclave)();
    }

    return self.sharedEnclave;
  }

  self.isFirstAdmin = async () => {
    const didDomain = await self.getDIDDomain();
    try {
      await $$.promisify(w3cDID.resolveDID)(`did:${constants.SSI_NAME_DID_TYPE}:${didDomain}:${constants.INITIAL_IDENTITY_PUBLIC_NAME}`);
    } catch (e) {
      return true;
    }

    return false;
  }

  self.createInitialDID = async () => {
    const didDomain = await self.getDIDDomain();
    await $$.promisify(w3cDID.createIdentity)(constants.SSI_NAME_DID_TYPE, didDomain, constants.INITIAL_IDENTITY_PUBLIC_NAME);
  }

  self.createGroups=async () => {
    const sharedEnclave = await self.getSharedEnclave();
    const messages = await $$.promisify(self.DSUStorage.getObject.bind(self.DSUStorage))(constants.GROUP_MESSAGES_PATH);
    await self.processMessages(sharedEnclave, messages);
  }

  self.createEnclaves = async () => {
    const mainEnclave = await self.getMainEnclave();
    const messages = await $$.promisify(self.DSUStorage.getObject.bind(self.DSUStorage))(constants.ENCLAVE_MESSAGES_PATH);
    await self.processMessages(mainEnclave, messages);
    console.log("Processed create enclave messages");
    const enclaveRecord = await mainEnclave.readKeyAsync(constants.SHARED_ENCLAVE);
    await $$.promisify(typicalBusinessLogicHub.setSharedEnclave)(enclaveRecord.enclaveKeySSI);
    await utils.addSharedEnclaveToEnv(enclaveRecord.enclaveType, enclaveRecord.enclaveDID, enclaveRecord.enclaveKeySSI);
    await self.storeSharedEnclaves();
  }

  self.storeSharedEnclaves= async () => {
    const mainEnclave = await self.getMainEnclave();
    const enclaves = await $$.promisify(mainEnclave.getAllRecords)(constants.TABLES.GROUP_ENCLAVES);
    const sharedEnclave = await self.getSharedEnclave();

    for (let i = 0; i < enclaves.length; i++) {
      await sharedEnclave.writeKeyAsync(enclaves[i].enclaveName, enclaves[i]);
      await sharedEnclave.insertRecordAsync(constants.TABLES.GROUP_ENCLAVES, enclaves[i].enclaveDID, enclaves[i]);
    }
    self.keySSI = await self.getSharedEnclaveKeySSI(sharedEnclave);

  }

  self.getSharedEnclaveKeySSI = async (sharedEnclave) => {
    let keySSI = await sharedEnclave.getKeySSIAsync();
    if (typeof keySSI !== "string" && keySSI.getIdentifier) {
      keySSI = keySSI.getIdentifier();
    }
    return keySSI;
  }

  self.firstOrRecoveryAdminToAdministrationGroup = async (did, userDetails, logAction = constants.OPERATIONS.SHARED_ENCLAVE_CREATE) => {
    if (typeof did !== "string") {
      did = did.getIdentifier();
    }
    const sharedEnclave = await self.getSharedEnclave();
    let adminGroup = await self.getAdminGroup(sharedEnclave);
    const addMemberToGroupMessage = {
      messageType: "AddMemberToGroup",
      groupDID: adminGroup.did,
      enclaveName: adminGroup.enclaveName,
      memberDID: did,
      memberName: userDetails
    };
    self.did = did;
    await utils.addLogMessage(did, logAction, adminGroup.name, self.userName || "-");

    await self.processMessages(sharedEnclave, addMemberToGroupMessage);
  }

  self.processMessages = async (storageService, messages) => {
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

  return self;
}
export default HomeController;
