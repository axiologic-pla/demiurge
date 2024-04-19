import {getStoredDID, setStoredDID, setMainDID} from "../services/BootingIdentityService.js";
import constants from "../constants.js";
import utils from "../utils.js";
import MessagesService from "../services/MessagesService.js";
import {getPermissionsWatcher} from "../services/PermissionsWatcher.js";

const {DwController} = WebCardinal.controllers;

const openDSU = require("opendsu");
const scAPI = openDSU.loadAPI("sc");
const w3cDID = openDSU.loadAPI("w3cdid");
const typicalBusinessLogicHub = w3cDID.getTypicalBusinessLogicHub();


function BootingIdentityController(...props) {

  if (history.state.isBack) {
    history.back();
    history.back();
    return;
  }

  let self = new DwController(...props);

  self.initPermissionsWatcher = () => {
    //we don't need any permissions watcher at this point in time
  };

  self.isFirstAdmin = history.state.state.isFirstAdmin;
  self.model = {
    domain: self.domain, username: self.userDetails
  };

  const {ui} = self;
  ui.disableMenu();

  self.onTagClick("paste-from-clipboard", async (model, target) => {
    const result = await navigator.permissions.query({
      name: "clipboard-read",
    });
    if (result.state === "granted" || result.state === "prompt") {
      const did = await navigator.clipboard.readText();
      target.parentElement.value = did;
      return {did};
    }
  });

  self.finishingStepOfWalletCreation = () => {
    self.initialisingModal.destroy();
    utils.setWalletStatus(constants.ACCOUNT_STATUS.CREATED).then(() => {
      self.element.addEventListener("copy-to-clipboard", async () => {
        let adminGroup = await utils.getAdminGroup(self.sharedEnclave);
        let groupName = utils.getGroupName(adminGroup);
        WebCardinal.wallet.groupName = groupName;
        await utils.addLogMessage(self.did, "Copy Break Glass Recovery Code", groupName, self.userName);
      })

      self.showModalFromTemplate("dw-dialog-break-glass-recovery/template", () => {
      }, async () => {
        await utils.autoAuthorization(self.did);
        self.accessWallet();
      }, {
        model: {sharedEnclaveKeySSI: self.keySSI},
        disableClosing: false,
        showCancelButton: false,
        disableExpanding: true,
        disableFooter: true,
        disableHeader: true
      });
    })

  }
  self.onAccessGranted = (message) => {
    utils.addSharedEnclaveToEnv(message.enclave.enclaveType, message.enclave.enclaveDID, message.enclave.enclaveKeySSI)
      .then(() => {
        utils.setWalletStatus(constants.ACCOUNT_STATUS.CREATED)
          .then(() => self.accessWallet()).catch(e => {
          self.notificationHandler.reportUserRelevantInfo("Failed to initialise wallet: ", e);
        });
      }).catch(e => {
      self.notificationHandler.reportUserRelevantInfo("Failed to properly execute authorization flow: ", e);
    });
  }

  self.accessWallet = async () => {
    self.ui.enableMenu();

    try {
      const sharedEnclave = await self.getSharedEnclave();
      let adminGroup = await utils.getAdminGroup(sharedEnclave);
      await utils.addLogMessage(self.did, constants.OPERATIONS.LOGIN, utils.getGroupName(adminGroup), self.userName);
      history.replaceState({isBack: true}, "");
      await utils.doMigration(sharedEnclave);
      self.navigateToPageTag("groups");
    } catch (e) {
      self.notificationHandler.reportDevRelevantInfo(`Failed to audit login action. Probably an infrastructure or network issue`, e);
      return alert(`Failed to audit login action. Probably an infrastructure or network issue. ${e.message}`);
    }
  }

  self.showInitDialog = async (did) => {
    if (typeof did === "object") {
      did = did.getIdentifier();
    }
    /*    await self.ui.showDialogFromComponent("dw-dialog-initialising", {did}, {
          parentElement: self.element, disableClosing: true,
        });*/

    self.initialisingModal = self.showModalFromTemplate("dw-dialog-initialising/template", () => {
    }, () => {
    }, {
      model: {did: did},
      disableClosing: true,
      showCancelButton: false,
      disableExpanding: true,
      disableFooter: true,
    })
  }


  self.waitForApproval = async (did) => {
    if (typeof did !== "string") {
      did = did.getIdentifier();
    }
    self.did = did;

    getPermissionsWatcher(did, () => {
      self.accessWallet();
    });

    let waitApprovalModal = self.showModalFromTemplate("waiting-approval/template", () => {
    }, () => {
    }, {
      model: {did: did},
      disableClosing: true,
      showCancelButton: false,
      disableExpanding: true,
      disableFooter: true,
    })

    self.onTagClick("continue", async (model, target) => {
      if (target.disabled) {
        return
      }
      try {
        const recoveryCode = document.getElementById("add-member-input").value;
        if (recoveryCode === "") {
          self.notificationHandler.reportUserRelevantError(`Please insert a recovery code.`);
          return;
        }

        target.loading = true;
        target.disabled = true;
        await self.setSharedEnclaveKeySSI(recoveryCode);
        let sharedEnclave = await self.getSharedEnclave();
        self.keySSI = await self.getSharedEnclaveKeySSI(sharedEnclave);
        await self.storeDID(self.did);
        await self.firstOrRecoveryAdminToAdministrationGroup(self.did, self.userDetails, constants.OPERATIONS.BREAK_GLASS_RECOVERY);
        await utils.setWalletStatus(constants.ACCOUNT_STATUS.CREATED);
        target.loading = false;
        waitApprovalModal.destroy();
        self.accessWallet();
      } catch (e) {
        self.notificationHandler.reportUserRelevantError("Failed to gain access to the wallet. Check your recovery code and try again");
        self.notificationHandler.reportDevRelevantInfo("Failed to gain access to the wallet with recovery code: ", e);
        target.loading = false;
        target.disabled = false;
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

  self.createInitialDID = async () => {
    const _createDID = async () => {
    const didDomain = await self.getDIDDomain();
      try {
        await $$.promisify(w3cDID.createIdentity)(constants.SSI_NAME_DID_TYPE, didDomain, constants.INITIAL_IDENTITY_PUBLIC_NAME);
      } catch (e) {
        self.notificationHandler.reportUserRelevantWarning(`Failed to create DID. Retrying ...`);
        throw e;
      }
    }

    await utils.retryAsyncFunction(_createDID, 3, 100);
  }

  self.createGroups = async () => {
    const sharedEnclave = await self.getSharedEnclave();
    const messages = await utils.readMappingEngineMessages(constants.GROUP_MESSAGES_PATH, self.DSUStorage);
    await self.processMessages(sharedEnclave, messages);
  }

  self.createEnclaves = async () => {
    const mainEnclave = await self.getMainEnclave();
    const messages = await utils.readMappingEngineMessages(constants.ENCLAVE_MESSAGES_PATH, self.DSUStorage);
    await self.processMessages(mainEnclave, messages);
    self.notificationHandler.reportUserRelevantInfo(`Processed create enclave messages`);
    await self.setSharedEnclave(mainEnclave);
    await self.storeSharedEnclaves();
  }

  self.setSharedEnclave = async (mainEnclave) => {
    const _setSharedEnclave = async () => {
      try {
        const enclaveRecord = await mainEnclave.readKeyAsync(constants.SHARED_ENCLAVE);
        await $$.promisify(typicalBusinessLogicHub.setSharedEnclave)(enclaveRecord.enclaveKeySSI);
        await utils.addSharedEnclaveToEnv(enclaveRecord.enclaveType, enclaveRecord.enclaveDID, enclaveRecord.enclaveKeySSI);
      } catch (e) {
        self.notificationHandler.reportUserRelevantWarning(`Failed to add shared enclave to environment. Retrying ...`);
        throw e;
      }
    };
    await utils.retryAsyncFunction(_setSharedEnclave, 3, 100);
  }

  self.storeSharedEnclaves = async () => {
    const mainEnclave = await self.getMainEnclave();
    const enclaves = await $$.promisify(mainEnclave.getAllRecords)(constants.TABLES.GROUP_ENCLAVES);
    const sharedEnclave = await self.getSharedEnclave();
    let batchId = await sharedEnclave.startOrAttachBatchAsync();
    try {
      for (let i = 0; i < enclaves.length; i++) {
        await sharedEnclave.writeKeyAsync(enclaves[i].enclaveName, enclaves[i]);
        await sharedEnclave.insertRecordAsync(constants.TABLES.GROUP_ENCLAVES, enclaves[i].enclaveDID, enclaves[i]);
      }
    } catch (e) {
      try {
        await sharedEnclave.cancelBatchAsync(batchId);
      } catch (err) {
        console.log(err);
      }
      throw e;
    }

    await sharedEnclave.commitBatchAsync(batchId);
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
    let adminGroup = await utils.getAdminGroup(sharedEnclave);
    const addMemberToGroupMessage = {
      messageType: constants.MESSAGE_TYPES.ADD_MEMBER_TO_GROUP,
      groupDID: adminGroup.did,
      enclaveName: adminGroup.enclaveName,
      memberDID: did,
      memberName: userDetails,
      accessMode: constants.ADMIN_ACCESS_MODE
    };
    self.did = did;
    await self.processMessages(sharedEnclave, addMemberToGroupMessage);
    await utils.addLogMessage(did, logAction, utils.getGroupName(adminGroup), self.userName || "-");
  }

  self.processMessages = async (storageService, messages) => {
    let remainingMessages = messages;
    const _processMessages = async (messages) => {
      if (!messages) {
        return
      }
      if (!Array.isArray(messages)) {
        messages = [messages];
      }

      let undigestedMessages = [];

      for (let i = 0; i < messages.length; i++) {
        try {
          undigestedMessages = await $$.promisify(MessagesService.processMessagesWithoutGrouping)(storageService, [messages[i]]);
        } catch (err) {
          console.log(err);
          remainingMessages = messages;
          self.notificationHandler.reportUserRelevantWarning(`Failed to process message: ${err.message}. Retrying ...`);
          throw err;
        }
        if (undigestedMessages && undigestedMessages.length > 0) {
          ui.showToast(`Couldn't process all messages. Retrying`);
          remainingMessages = undigestedMessages.map(msgObj => msgObj.message);
          console.log("Remaining messages:", remainingMessages);
          throw new Error("Couldn't process all messages.");
        }
      }
    }

    await utils.retryAsyncFunction(_processMessages, 3, 100, remainingMessages);
  }

  typicalBusinessLogicHub.mainDIDCreated(async (error, did) => {
    if (error) {
      console.log(error);
      return alert(`Failed to initialise. Probably an infrastructure issue. ${error.message}`);
    }
    if (self.isFirstAdmin) {
      if (did) {
        return;
      }

      self.createDID(async (err, model) => {
        if (err) {
          return alert(`Failed to create did. Probably an infrastructure issue. ${err.message}`);
        }
        const {didDocument, submitElement} = model;
        await setMainDID(typicalBusinessLogicHub, didDocument, self.notificationHandler);
        submitElement.loading = true;
        try {
          await self.createInitialDID();
          await self.showInitDialog();
          await self.createEnclaves();
          self.notificationHandler.reportUserRelevantInfo("Created enclaves");
          await self.createGroups();
          self.notificationHandler.reportUserRelevantInfo("Created groups");
          await self.firstOrRecoveryAdminToAdministrationGroup(didDocument, self.userDetails);

          //we need to auto-authorize because we are the first one...
          await utils.autoAuthorization(self.did);

          self.notificationHandler.reportUserRelevantInfo("Waiting for final initialization steps");
          self.finishingStepOfWalletCreation();
        } catch (e) {
          console.log(e);
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
          await setMainDID(typicalBusinessLogicHub, didDocument, self.notificationHandler);
          await self.waitForApproval(didDocument);
          submitElement.loading = false;
        } catch (e) {
          return alert(`Failed to subscribe. Probably an infrastructure issue. ${err.message}`);
        }
      });
    }
  });


  return self;
}

export default BootingIdentityController;
