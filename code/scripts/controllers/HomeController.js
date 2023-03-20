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
  try {
    this.skipLoginAudit = history.state.state.skipLoginAudit || false;
  } catch (e) {
    this.skipLoginAudit = false;
  }
  self.model = {
    domain: self.domain, username: self.userDetails
  };

  const {ui} = self
  getWalletStatus().then(async status => {
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
          if (err) {
            return alert(`Failed to create did. Probably an infrastructure issue. ${err.message}`);
          }
          const {didDocument, submitElement} = model;
          await self.setMainDID(typicalBusinessLogicHub, didDocument);
          submitElement.loading = true;
          try {
            await self.createInitialDID();
            await self.showInitDialog();
            await self.createEnclaves();
            self.notificationHandler.reportUserRelevantInfo("Created enclaves");
            await self.createGroups();
            self.notificationHandler.reportUserRelevantInfo("Created groups");
            typicalBusinessLogicHub.subscribe(constants.MESSAGE_TYPES.ADD_MEMBER_TO_GROUP, self.onReceivedInitMessage)
            await self.firstOrRecoveryAdminToAdministrationGroup(didDocument, self.userDetails);
            self.notificationHandler.reportUserRelevantInfo("Waiting for final initialization steps");
          } catch (e) {
            return alert(`Failed to initialise. Probably an infrastructure issue. ${e.message}`);
          }

        });
      } else {
        if (did) {
          await self.waitForApproval(did);
          return;
        }
        self.createDID(async (err, model) => {
          if (err) {
            return alert(`Failed create did. Probably an infrastructure issue. ${err.message}`);
          }
          const {didDocument, submitElement} = model;
          submitElement.loading = true;
          try {
            await $$.promisify(typicalBusinessLogicHub.setMainDID)(didDocument.getIdentifier());
            await self.setMainDID(typicalBusinessLogicHub, didDocument);
            await self.waitForApproval(didDocument);
            submitElement.loading = false;
          } catch (e) {
            return alert(`Failed to subscribe. Probably an infrastructure issue. ${err.message}`);
          }
        });
      }
    } else {
      let did;
      try {
        did = await getStoredDID();
      } catch (err) {
      }
      if (did) {
        await self.setMainDID(typicalBusinessLogicHub, did);
      }
      self.showQuickActions();
    }
  }).catch(async e => {
    self.notificationHandler.reportUserRelevantError("Failed to initialise wallet ", e);
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
          self.notificationHandler.reportDevRelevantInfo("Finished processing message " + JSON.stringify(message));
        })
      }).catch(e => {
        self.notificationHandler.reportUserRelevantInfo("Failed to initialise wallet: ", e);
      })
    }).catch(e => {
      self.notificationHandler.reportDevRelevantInfo("hideDialogFromComponent", e);
    });
    // submitElement.loading = false;

  }
  self.onAccessGranted = (message) => {
    utils.addSharedEnclaveToEnv(message.enclave.enclaveType, message.enclave.enclaveDID, message.enclave.enclaveKeySSI)
      .then(() => {
        self.ui.hideDialogFromComponent("dw-dialog-waiting-approval")
          .then(() => {
            setWalletStatus(constants.ACCOUNT_STATUS.CREATED)
              .then(() => self.showQuickActions()).catch(e => {
              self.notificationHandler.reportUserRelevantInfo("Failed to initialise wallet: ", e);
            });
          }).catch(e => {
          self.notificationHandler.reportDevRelevantInfo("hideDialogFromComponent", e);
        })
      }).catch(e => {
      self.notificationHandler.reportUserRelevantInfo("Failed to properly execute authorization flow: ", e);
    });
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

    if (!this.skipLoginAudit) {
      self.getSharedEnclave().then(async (sharedEnclave) => {
        let adminGroup = await self.getAdminGroup(sharedEnclave);
        await utils.addLogMessage(self.did, constants.OPERATIONS.LOGIN, adminGroup.name, self.userName);
      }).catch(e => {
        self.notificationHandler.reportDevRelevantInfo(`Failed to audit login action. Probably an infrastructure or network issue`, e);
        return alert(`Failed to audit login action. Probably an infrastructure or network issue. ${e.message}`);
      });
    }

  }

  self.setMainDID = async (typicalBusinessLogicHub, didDocument) => {
    if (typeof didDocument === "object") {
      didDocument = didDocument.getIdentifier();
    }
    try {
      await $$.promisify(typicalBusinessLogicHub.setMainDID)(didDocument);
    } catch (e) {
      self.notificationHandler.reportUserRelevantInfo(`Failed to initialise communication layer. Retrying ...`);
      await self.setMainDID(typicalBusinessLogicHub, didDocument);
    }
  }

  self.getAdminGroup = async (sharedEnclave) => {
    const tryToGetAdminGroup = async () => {
      let groups = [];
      try {
        groups = await utils.promisify(sharedEnclave.filter)(constants.TABLES.GROUPS);
        let adminGroup = groups.find((gr) => gr.accessMode === constants.ADMIN_ACCESS_MODE || gr.name === constants.EPI_ADMIN_GROUP_NAME) || {};
        if (!adminGroup) {
          throw new Error("Admin group not created yet.")
        }
        return adminGroup;
      } catch (e) {
        self.notificationHandler.reportUserRelevantInfo(`Failed to get info about admin group. Retrying ...`, e);
        return await tryToGetAdminGroup();
      }
    }
    return await tryToGetAdminGroup();
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

    self.onTagClick("paste-from-clipboard", async (model, target, event) => {
      const result = await navigator.permissions.query({
        name: "clipboard-read",
      });
      if (result.state === "granted" || result.state === "prompt") {
        const did = await navigator.clipboard.readText();
        target.parentElement.value = did;
        return {did};
      }
    });

    self.onTagClick("continue", async (model, target, event) => {
      try {
        const recoveryCode = document.getElementById("add-member-input").value;
        if (recoveryCode === "") {
          self.notificationHandler.reportUserRelevantError(`Please insert a recovery code.`);
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
        self.notificationHandler.reportUserRelevantError("Failed to gain access to the wallet. Check your recovery code and try again", e)
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

  self.createDID = (callback) => {
    self.onTagEvent("did-component", "did-generate", async (model) => {
      try {
        await self.storeDID(model.didDocument);
      } catch (e) {
        return callback(createOpenDSUErrorWrapper("Failed to store DID", e));
      }
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
      try {
        self.mainEnclave = await $$.promisify(scAPI.getMainEnclave)();
      } catch (e) {
        self.notificationHandler.reportUserRelevantWarning(`Failed to get main enclave: ${e.message}. Retrying ...`);
        return await self.getMainEnclave();
      }
    }

    return self.mainEnclave;
  }

  self.getSharedEnclave = async () => {
    if (!self.sharedEnclave) {
      try {
        self.sharedEnclave = await $$.promisify(scAPI.getSharedEnclave)();
      } catch (e) {
        self.notificationHandler.reportUserRelevantWarning(`Failed to get shared enclave: ${e.message}. Retrying ...`);
        return await self.getSharedEnclave();
      }
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
    try {
      await $$.promisify(w3cDID.createIdentity)(constants.SSI_NAME_DID_TYPE, didDomain, constants.INITIAL_IDENTITY_PUBLIC_NAME);
    } catch (e) {
      self.notificationHandler.reportUserRelevantWarning(`Failed to create DID. Retrying ...`);
      await self.createInitialDID();
    }
  }

  self.createGroups = async () => {
    const sharedEnclave = await self.getSharedEnclave();
    const messages = await self.readMappingEngineMessages(constants.GROUP_MESSAGES_PATH);
    await self.processMessages(sharedEnclave, messages);
  }

  self.readMappingEngineMessages = async (path) => {
    let messages;
    try {
      messages = await $$.promisify(self.DSUStorage.getObject.bind(self.DSUStorage))(path);
    } catch (e) {

    }
    if (!messages) {
      self.notificationHandler.reportUserRelevantWarning(`Failed to retrieve configuration data. Retrying ...`);
      return await self.readMappingEngineMessages(path);
    }
    return messages;
  }
  self.createEnclaves = async () => {
    const mainEnclave = await self.getMainEnclave();
    const messages = await self.readMappingEngineMessages(constants.ENCLAVE_MESSAGES_PATH);
    await self.processMessages(mainEnclave, messages);
    self.notificationHandler.reportUserRelevantInfo(`Processed create enclave messages`);
    await self.setSharedEnclave(mainEnclave);
    await self.storeSharedEnclaves();
  }

  self.setSharedEnclave = async (mainEnclave) => {
    const tryToSetSharedEnclave = async () => {
      try {
        const enclaveRecord = await mainEnclave.readKeyAsync(constants.SHARED_ENCLAVE);
        await $$.promisify(typicalBusinessLogicHub.setSharedEnclave)(enclaveRecord.enclaveKeySSI);
        await utils.addSharedEnclaveToEnv(enclaveRecord.enclaveType, enclaveRecord.enclaveDID, enclaveRecord.enclaveKeySSI);
      } catch (e) {
        self.notificationHandler.reportUserRelevantWarning(`Failed to add shared enclave to environment. Retrying ...`);
        await tryToSetSharedEnclave();
      }
    }

    await tryToSetSharedEnclave();
  }

  self.storeSharedEnclaves = async () => {
    const mainEnclave = await self.getMainEnclave();
    const enclaves = await $$.promisify(mainEnclave.getAllRecords)(constants.TABLES.GROUP_ENCLAVES);
    const sharedEnclave = await self.getSharedEnclave();
    sharedEnclave.beginBatch();
    for (let i = 0; i < enclaves.length; i++) {
      await sharedEnclave.writeKeyAsync(enclaves[i].enclaveName, enclaves[i]);
      await sharedEnclave.insertRecordAsync(constants.TABLES.GROUP_ENCLAVES, enclaves[i].enclaveDID, enclaves[i]);
    }

    await sharedEnclave.commitBatchAsync();
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
      messageType: constants.MESSAGE_TYPES.ADD_MEMBER_TO_GROUP,
      groupDID: adminGroup.did,
      enclaveName: adminGroup.enclaveName,
      memberDID: did,
      memberName: userDetails
    };
    self.did = did;
    await self.processMessages(sharedEnclave, addMemberToGroupMessage);
    await utils.addLogMessage(did, logAction, adminGroup.name, self.userName || "-");
  }

  self.processMessages = async (storageService, messages) => {
    if (!messages) {
      return
    }
    if (!Array.isArray(messages)) {
      messages = [messages];
    }

    let undigestedMessages = [];
    try {
      undigestedMessages = await $$.promisify(MessagesService.processMessagesWithoutGrouping)(storageService, messages);
    } catch (err) {
      return await self.processMessages(storageService, messages);
    }
    if (undigestedMessages && undigestedMessages.length > 0) {
      const remainingMessages = undigestedMessages.map(msgObj => msgObj.message);
      self.notificationHandler.reportDevRelevantInfo("Undigested messages:", JSON.stringify(remainingMessages));
      self.notificationHandler.reportUserRelevantWarning(`Couldn't process all messages. Retrying ...`);
      return await self.processMessages(storageService, remainingMessages);
    }
  }

  return self;
}

export default HomeController;
