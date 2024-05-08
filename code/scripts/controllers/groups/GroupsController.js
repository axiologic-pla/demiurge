import constants from "../../constants.js";
import utils from "../../utils.js";
import {cloneTemplate} from "../../../components/utils.js";
import MessagesService from "../../services/MessagesService.js";

const {DwController} = WebCardinal.controllers;
const {promisify} = utils;

class GroupsUI extends DwController {
  constructor(...props) {
    super(...props);

  }

  // listeners
  addGroupContentListener() {
    const part = "group-content";
    const rootElement = this.querySelector(`#dw-${part}`);
    const subParts = {
      [part]: ["group-members"],
    };

    this.model.onChange("selectedGroup", ({targetChain}) => {
      if (targetChain !== "selectedGroup") {
        return;
      }

      rootElement.innerHTML = "";

      this.updateState("selectedGroup", this.model.selectedGroup);

      if (!this.model.selectedGroup) {
        return;
      }

      this.element.querySelectorAll(".tab-header").forEach((tabHeader, index) => {
        tabHeader.classList.remove("selected");
        if (index === this.model.selectedTabIndex) {
          tabHeader.classList.add("selected");
        }
      })

      const documentFragment = cloneTemplate(part);

      for (const subPart of subParts[part]) {
        const parentElement = documentFragment.querySelector(`#dw-${subPart}`);
        if (parentElement) {
          parentElement.append(cloneTemplate(subPart));
        }
      }

      rootElement.append(documentFragment);
    });
  }

  // methods
  async selectGroup(model, target) {
    if (target.checked) {
      target.checked = false;
      return undefined;
    }

    Array.from(target.parentElement.parentElement.children).forEach((item) => {
      item.firstElementChild.checked = false;
    });

    target.checked = true;
    return model;
  }
}

class GroupsController extends DwController {
  constructor(...props) {
    super(...props);
    const {ui} = this;

    this.model = {
      // blockchainDomain: "example.domain",
      groups: [],
      selectedGroup: undefined,
      areGroupsLoaded: false,
      selectedTabIndex: 0
    };

    ui.page = new GroupsUI(...props);
    // ui.page.addBlockchainDomainListener();
    ui.page.addGroupContentListener.call(this);


    this.onTagClick("recover-data-key", async () => {
      const openDSU = require("opendsu");
      const scAPI = openDSU.loadAPI("sc");
      try {
        const sharedEnclave = await $$.promisify(scAPI.getSharedEnclave)();
        const epiEnclaveRecord = await $$.promisify(sharedEnclave.readKey)(constants.EPI_SHARED_ENCLAVE);
        let enclaveKeySSI = epiEnclaveRecord.enclaveKeySSI;
        this.recoveryDataKeyModal = this.showModalFromTemplate("dw-dialog-data-recovery/template", () => {
        }, () => {
        }, {
          model: {
            dataRecoveryKey: enclaveKeySSI,
          },
          disableClosing: false,
          showCancelButton: false,
          disableExpanding: true,
          disableFooter: true,
        })
      } catch (e) {
        this.notificationHandler.reportUserRelevantError(`Couldn't get sharedEnclaveKeySSI.`);
      }

    })

    this.element.addEventListener("copy-to-clipboard", async () => {
      await utils.addLogMessage(this.did, "Copy Data Recovery Key", this.groupName, this.userName);
    })

    this.element.addEventListener("copy-paste-change", async (e) => {
      if (e.target.id !== "data-recovery-key-input") {
        return;
      }
      if (e.detail.value && e.detail.value.trim()) {
        document.querySelector(".submit-recovery-button").disabled = false;
      } else {
        document.querySelector(".submit-recovery-button").disabled = true;
      }
    })

    this.onTagClick("data-recovery-key-submit", async () => {
      const recoveryCode = document.getElementById("data-recovery-key-input").value;
      if (recoveryCode === "") {
        this.notificationHandler.reportUserRelevantError(`Please insert Data Recovery Key.`);
        return;
      }
      try {
        let messages = await utils.readMappingEngineMessages(constants.ENCLAVE_MESSAGES_PATH, this.DSUStorage);
        let epiEnclaveMsg = messages.find((msg) => msg.enclaveName === this.model.selectedGroup.enclaveName)
        if (!epiEnclaveMsg) {
          this.notificationHandler.reportUserRelevantError(`Wrong or missing enclave name`);
          return;
        }
        let enclaveRecord;
        try {
          enclaveRecord = await utils.initSharedEnclave(recoveryCode, epiEnclaveMsg, true);
        } catch (e) {
          this.recoveryDataKeyModal.destroy()
          this.notificationHandler.reportUserRelevantError(`Couldn't initialize wallet DBEnclave with provided code`);
        }
        await utils.setEpiEnclave(enclaveRecord);
        // trigger migration in case total data loss recovery
        await utils.doMigration(undefined, true);
        await utils.addLogMessage(this.did, "Use of the Data Recovery Key", this.groupName, this.userName);
      } catch (e) {
        this.notificationHandler.reportUserRelevantError(`Couldn't initialize wallet DBEnclave with provided code`);
      }

      this.recoveryDataKeyModal.destroy()
    })
    this.onTagClick("group.add", async (...props) => {
      try {
        const {name} = await ui.page.addGroup(...props);
        const group = await $$.promisify(this.addGroup)({name});
        this.model.selectedGroup = undefined;
        this.model.groups.push(group);
        // await ui.showToast(group);
      } catch (err) {
        this.notificationHandler.reportDevRelevantInfo("Caught an error", err)
      }
    });

    /*    const groupSelect = document.querySelector('select.group-select');
        groupSelect.addEventListener('change', event => {
          this.model.selectedGroup = this.model.groups.find(group => group.pk === event.target.value);
          //after select is done focus out select input
          groupSelect.blur();
        });*/

    this.onTagClick("select-tab", (model, target) => {
      this.model.selectedTabIndex = this.model.groups.findIndex(group => group.pk === target.getAttribute("tab-name"));
      this.model.selectedGroup = this.model.groups[this.model.selectedTabIndex];
    })

    this.onTagClick("group.delete", async (deletedGroup) => {
      try {
        await this.deleteGroup(deletedGroup);
        this.model.selectedGroup = undefined;
        this.model.groups = this.model.groups.filter((group) => group.did !== deletedGroup.did);
        // await ui.showToast(deletedGroup);
      } catch (err) {
        this.notificationHandler.reportDevRelevantInfo("Caught an error", err)
      }
    });

    const __waitForSharedEnclave = () => {
      setTimeout(async () => {
        const scAPI = require("opendsu").loadAPI("sc");
        if (scAPI.sharedEnclaveExists()) {
          this.model.groups = await utils.fetchGroups();
          this.model.defaultGroup = this.model.groups[0];
          this.model.selectedGroup = this.model.groups[0];
          this.model.areGroupsLoaded = true;
        } else {
          __waitForSharedEnclave();
        }
      }, 100);
    }
    __waitForSharedEnclave();
  }

  /**
   * @param {object} group
   * @param {string} group.name
   **/
  async addGroup(group, callback) {
    const createGroupMessage = {
      messageType: "CreateGroup",
      groupName: group.name,
    };

    const scAPI = require("opendsu").loadAPI("sc");
    if (group.name === constants.EPI_ADMIN_GROUP) {
      scAPI.getMainEnclave(async (err, mainEnclave) => {
        if (err) {
          return callback(err);
        }
        return await processMessages(mainEnclave);
      })
    } else {
      scAPI.getSharedEnclave(async (err, sharedEnclave) => {
        if (err) {
          return callback(err);
        }
        await processMessages(sharedEnclave);
      })
    }

    const processMessages = async (storageService) => {
      let undigestedMessages;
      try {
        undigestedMessages = await $$.promisify(MessagesService.processMessagesWithoutGrouping)(storageService, createGroupMessage)
      } catch (e) {
        undigestedMessages = [createGroupMessage];
      }

      if (undigestedMessages && undigestedMessages.length > 0) {
        this.ui.showToast(`Failed to create group ${group.name}`, {type: 'danger'});
        console.log("Undigested messages:", undigestedMessages);
        return;
      }

      const openDSU = require("opendsu");
      const scAPI = openDSU.loadAPI("sc");
      const enclaveDB = await $$.promisify(scAPI.getMainEnclave)();
      const sharedEnclaveDB = await $$.promisify(scAPI.getSharedEnclave)();
      const groups = await promisify(sharedEnclaveDB.getAllRecords)(constants.TABLES.GROUPS);
      group.did = groups.find((gr) => gr.name === group.name).did;
      const adminDID = await enclaveDB.readKeyAsync(constants.IDENTITY);

      const addMemberToGroupMessage = {
        messageType: constants.MESSAGE_TYPES.ADD_MEMBER_TO_GROUP,
        groupDID: group.did,
        memberDID: adminDID.did,
        memberName: adminDID.username,
        auditData: {
          action: constants.OPERATIONS.ADD,
          userGroup: this.model.selectedGroup.name,
          userDID: null,
        }
      };

      try {
        undigestedMessages = await $$.promisify(MessagesService.processMessagesWithoutGrouping)(storageService, addMemberToGroupMessage)
      } catch (e) {
        undigestedMessages = [addMemberToGroupMessage];
      }
      if (undigestedMessages && undigestedMessages.length > 0) {
        this.notificationHandler.reportDevRelevantInfo("Undigested messages: ", JSON.stringify(undigestedMessages))
        this.notificationHandler.reportUserRelevantError(`Failed add member ${addMemberToGroupMessage.memberDID} to group ${group.name}`)
      }
    }
  }


  /**
   * @param {object} group
   * @param {string} group.did
   **/
  async deleteGroup(group) {
    const deleteGroupMessage = {
      messageType: "DeleteGroup",
      groupDID: group.did,
      auditData: {
        action: constants.OPERATIONS.REMOVE,
        userGroup: this.model.selectedGroup.name,
        userDID: null
      }
    };
    await MessagesService.processMessages([deleteGroupMessage], () => {
    });
  }
}

export default GroupsController;
