import constants from "../../constants.js";
import utils from "../../utils.js";
import MessagesService from "../../services/MessagesService.js";

const {DwController} = WebCardinal.controllers;
const {promisify} = utils;

class MembersUI extends DwController {
  constructor(...props) {
    super(...props);

    this.selectionElements = {
      sectionElement: this.querySelector(".dw-members"),
      addButtonElement: this.querySelector("sl-form"),
      deleteButtonElement: this.getElementByTag("member.delete"),
    };

    this.history.listen(() => {
      if (WebCardinal.state.loaders) {
        WebCardinal.state.loaders.newElement.remove();
        WebCardinal.state.loaders.oldElement.hidden = false;
        delete WebCardinal.state.loaders;
      }
    });
  }

  // listeners


  addPasteMemberDIDFromClipboardListener() {
    this.onTagClick("member.paste", async (model, target) => {
      try {
        const result = await navigator.permissions.query({
          name: "clipboard-read",
        });
        if (result.state === "granted" || result.state === "prompt") {
          const did = await navigator.clipboard.readText();
          target.parentElement.value = did;
          return {did};
        }
        throw Error("Coping from clipboard is not possible!");
      } catch (err) {
        target.remove();
        console.log(err);
        return "";
      }
    });
  }

  // methods


  async addMember(model, target) {
    return await this.ui.submitGenericForm(model, target);
  }

  loadMemberPage(state) {
    const src = new URL(`/pages/member.html`, window.location).pathname;

    const newElement = document.createElement("webc-app-loader");

    newElement.src = `.${src}`;
    newElement.basePath = WebCardinal.basePath;

    const {loader: oldElement} = WebCardinal.state.page;

    WebCardinal.state.loaders = {
      newElement,
      oldElement,
    };

    oldElement.parentElement.insertBefore(newElement, oldElement);
    oldElement.hidden = true;

    window.history.pushState(JSON.stringify(state), null, window.location.href);
  }
}

class MembersController extends DwController {
  constructor(...props) {
    super(...props);
    const {ui} = this;
    const {selectedGroup} = this.getState();

    this.model = {
      selectedGroup,
      selectedMember: undefined,
      members: [],
      areMembersLoaded: false,
    };

    ui.page = new MembersUI(...props);
    ui.page.addPasteMemberDIDFromClipboardListener();

    this.onTagClick("member.add", async (model, button) => {
      let inputElement = document.querySelector("#add-member-input");

      const newMemberDid = inputElement.value;
      try {
        if (!newMemberDid) {
          throw new Error("DID is empty.");
        }

        let groups = await utils.fetchGroups();
        let selectedGroup = constants.EPI_GROUP_TAGS.find(group => group.name === this.model.selectedGroup.name);
        if (!selectedGroup) {
          selectedGroup = groups.find(group => group.name === this.model.selectedGroup.name);
        }

        let hasGroupTag = selectedGroup.tags.split(',').findIndex(tag => newMemberDid.includes(tag.trim())) !== -1;
        if (!hasGroupTag) {
          throw new Error('User can not be added to selected group. Please check user group.');
        }

        button.loading = true;
        let allMembers = [];
        for (let i = 0; i < groups.length; i++) {
          let groupMembers = await this.fetchMembers(groups[i]);
          allMembers = [...allMembers, ...groupMembers]
        }
        let alreadyExists = allMembers.find(arrMember => arrMember.did === newMemberDid)
        if (alreadyExists) {
          button.loading = false;
          throw new Error("Member already registered in a group!");
        }
        await ui.showDialogFromComponent(
          "dw-dialog-group-members-update",
          {
            action: "Adding",
            did: model.did,
          },
          {
            parentElement: this.element,
            disableClosing: true,
          }
        );
        const member = await this.addMember(this.model.selectedGroup, {did: newMemberDid});
        this.model.members.push(member);
        button.loading = false;
        await ui.hideDialogFromComponent("dw-dialog-group-members-update");

      } catch (e) {
        await ui.showToast("Could not add user to the group because: " + e.message);
      }

      const {did} = await ui.page.addMember(model, button);
      button.loading = false;
    });

    this.onTagClick("member.select", (selectedMember, ...props) => {
      this.model.selectedMember = selectedMember;
      ui.page.loadMemberPage({selectedGroup, selectedMember});
    });

    this.onTagClick("member.delete", async (model, target, event) => {
      await removeGroupMember(model.did, constants.OPERATIONS.REMOVE)
      // ui.page.closeMultipleSelection();
    });

    this.onTagClick("member.deactivate", async (model, target, event) => {
      await removeGroupMember(model.did, constants.OPERATIONS.DEACTIVATE)
      // ui.page.closeMultipleSelection();
    });
    let removeGroupMember = async (did, operation) => {

      await ui.showDialogFromComponent(
        "dw-dialog-group-members-update",
        {
          action: operation === constants.OPERATIONS.REMOVE ? "Deleting" : "Deactivating",
          did: did,
        },
        {
          parentElement: this.element,
          disableClosing: true,
        }
      );
      let undeleted = await this.deleteMembers(this.model.selectedGroup, did, operation);
      await ui.hideDialogFromComponent("dw-dialog-group-members-update");

      if (undeleted.length > 0) {
        await ui.showToast("Member could not deleted");
        return;
      }
      this.model.members = this.model.members.filter((member) => member.did !== did);
    }
    setTimeout(async () => {
      this.model.members = await this.fetchMembers();
      this.model.areMembersLoaded = true;
    });
  }

  async fetchMembers(group) {
    if (!group) {
      group = this.model.selectedGroup;
    }
    return new Promise((resolve, reject) => {
      const w3cDID = require("opendsu").loadAPI("w3cdid");
      w3cDID.resolveDID(group.did, (err, groupDIDDocument) => {
        if (err) {
          return reject(err);
        }

        groupDIDDocument.listMembersInfo((err, members) => {
          if (err) {
            return reject(err);
          }

          return resolve(members);
        });
      });
    });
  }

  /**
   * @param {object} group
   * @param {string} group.did
   * @param {object} member
   * @param {string} member.did
   */
  async addMember(group, member) {
    try {
      const w3cDID = require("opendsu").loadAPI("w3cdid");
      const didDocument = await promisify(w3cDID.resolveDID)(member.did);
      member["username"] = didDocument.getName();
      const addMemberToGroupMessage = {
        messageType: "AddMemberToGroup",
        groupDID: group.did,
        enclaveName: group.enclaveName,
        accessMode: group.accessMode,
        memberDID: member.did,
        memberName: member.username,
        auditData: {
          action: constants.OPERATIONS.ADD,
          userGroup: group.name,
          userDID: member.did
        }
      };
      MessagesService.processMessages([addMemberToGroupMessage], async () => {
        console.log("Processed messages");
      });
      return member;
    } catch (err) {
      console.log(err);
      throw err;
    }
  }

  /**
   * @param {object} group
   * @param {string} group.did
   * @param {array<{did: string}>} members
   */
  async deleteMembers(group, memberDID, operation) {
    let deleteMmbersMsg = [{
      messageType: operation === constants.OPERATIONS.REMOVE ? "RemoveMembersFromGroup" : "DeactivateMember",
      groupDID: group.did,
      memberDID: memberDID,
      groupName: group.name,
      auditData: {
        action: operation === constants.OPERATIONS.REMOVE ? constants.OPERATIONS.REMOVE : constants.OPERATIONS.DEACTIVATE,
        userGroup: group.name,
        userDID: memberDID
      }
    }];

    let undigestedMessages = await MessagesService.processMessages(deleteMmbersMsg, async () => {

      console.log("Processed messages");
    })
    undigestedMessages = undigestedMessages || [];
    return undigestedMessages.map(msg => {
      return {did: msg.memberDID}
    });
  }

  async notifyMember(group, member) {
    await utils.sendUserMessage(
      this.identity.did,
      group,
      member,
      "",
      constants.CONTENT_TYPE.GROUP_MEMBER,
      constants.RECIPIENT_TYPES.GROUP_RECIPIENT,
      constants.OPERATIONS.ADD
    );
  }
}

export default MembersController;
