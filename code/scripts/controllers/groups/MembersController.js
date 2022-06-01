import constants from "../../constants.js";
import utils from "../../utils.js";
import MessagesService from "../../services/MessagesService.js";

const {DwController} = WebCardinal.controllers;
const {promisify} = utils;

class MembersUI extends DwController {
  constructor(...props) {
    super(...props);

    this.isSelectMultiple = false;
    this.selectedMembers = [];
    this.selectionElements = {
      sectionElement: this.querySelector(".dw-members"),
      openButtonElement: this.getElementByTag("member.open-multiple-selection"),
      closeButtonElement: this.getElementByTag("member.close-multiple-selection"),
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

  addMultipleSelectionListeners() {
    const {openButtonElement, closeButtonElement} = this.selectionElements;

    openButtonElement.addEventListener("click", () => {
      this.openMultipleSelection();
    });

    closeButtonElement.addEventListener("click", () => {
      this.closeMultipleSelection();
    });
  }

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

  openMultipleSelection() {
    const {
      sectionElement,
      openButtonElement,
      closeButtonElement,
      addButtonElement,
      deleteButtonElement,
    } = this.selectionElements;
    openButtonElement.setAttribute("hidden", "");
    addButtonElement.setAttribute("hidden", "");
    closeButtonElement.removeAttribute("hidden");
    deleteButtonElement.removeAttribute("hidden");
    this.isSelectMultiple = true;

    sectionElement.querySelectorAll(".dw-member").forEach((memberElement) => {
      const checkboxElement = memberElement.querySelector("sl-checkbox");
      checkboxElement.classList.add("active");
    });
  }

  closeMultipleSelection() {
    const {
      sectionElement,
      openButtonElement,
      closeButtonElement,
      addButtonElement,
      deleteButtonElement,
    } = this.selectionElements;
    openButtonElement.removeAttribute("hidden");
    addButtonElement.removeAttribute("hidden");
    closeButtonElement.setAttribute("hidden", "");
    deleteButtonElement.setAttribute("hidden", "");
    this.isSelectMultiple = false;

    sectionElement.querySelectorAll(".dw-member").forEach((memberElement) => {
      const checkboxElement = memberElement.querySelector("sl-checkbox");
      checkboxElement.classList.remove("active");
      checkboxElement.checked = false;
    });
  }

  isMultipleSelectionActive(target) {
    if (!target) {
      return this.isSelectMultiple;
    }

    if (this.isSelectMultiple) {
      const checkboxElement = target.querySelector("sl-checkbox");
      checkboxElement.checked = !checkboxElement.checked;
      return true;
    }
    return false;
  }

  async addMember(model, target) {
    return await this.ui.submitGenericForm(model, target);
  }

  async deleteMembers() {
    if (this.isSelectMultiple) {
      const deletedMembers = new Set();
      const sectionElement = this.querySelector(".dw-members");
      sectionElement.querySelectorAll(".dw-member").forEach((memberElement) => {
        const checkboxElement = memberElement.querySelector("sl-checkbox");
        const itemElement = memberElement.parentElement;
        if (checkboxElement.checked) {
          deletedMembers.add(itemElement.value);
        }
      });
      return [...deletedMembers];
    }

    if (this.selectedMember) {
      const deletedMembers = [this.selectedMember.did];
      this.ui.hideDialogFromComponent("dw-dialog-edit-member");
      return deletedMembers;
    }
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
    ui.page.addMultipleSelectionListeners();
    ui.page.addPasteMemberDIDFromClipboardListener();

    this.onTagClick("member.add", async (model, button) => {
      let inputElement = document.querySelector("#add-member-input");


      try {
        if (!inputElement.value) {
          throw new Error("DID is empty.");
        }
        button.loading = true;
        let groups = await utils.fetchGroups();
        let allMembers = [];
        for (let i = 0; i < groups.length; i++) {
          let groupMembers = await this.fetchMembers(groups[i]);
          allMembers = [...allMembers, ...groupMembers]
        }
        let alreadyExists = allMembers.find(arrMember => arrMember.did === inputElement.value)
        if (alreadyExists) {
          button.loading = false;
          throw new Error("Member already registered in a group!");
        }
        const member = await this.addMember(this.model.selectedGroup, {did: inputElement.value});
        this.model.members.push(member);
        button.loading = false;
      } catch (e) {
        await ui.showToast("Could not add user to the group because: " + e.message);
      }

      const {did} = await ui.page.addMember(model, button);
      button.loading = false;
    });

    this.onTagClick("member.select", (selectedMember, ...props) => {
      if (!ui.page.isMultipleSelectionActive(...props)) {
        this.model.selectedMember = selectedMember;
        ui.page.loadMemberPage({selectedGroup, selectedMember});
      }
    });

    this.onTagClick("member.delete", async (...props) => {
      const deletedMembers = await ui.page.deleteMembers(...props);
      await this.deleteMembers(this.model.selectedGroup, deletedMembers);
      while (deletedMembers.length > 0) {
        const did = deletedMembers.pop();
        this.model.members = this.model.members.filter((member) => member.did !== did);
      }
      ui.page.closeMultipleSelection();
    });

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
        memberDID: member.did,
        memberName: member.username,
      };
      MessagesService.processMessages([addMemberToGroupMessage], () => {
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
  async deleteMembers(group, members) {
    const deleteMembersFromGroupMessage = {
      messageType: "RemoveMembersFromGroup",
      groupDID: group.did,
      memberDIDs: members
    }
    MessagesService.processMessages(deleteMembersFromGroupMessage, () => {
      console.log("Processed messages");
    })
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
