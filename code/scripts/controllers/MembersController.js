import constants from "../constants.js";
import utils from "../utils.js";
import Message from "../utils/Message.js";

const promisify = utils.promisify;
const { DwController } = WebCardinal.controllers;

class MembersUI extends DwController {
  constructor(...props) {
    super(...props);

    this.isSelectMultiple = false;
    this.selectedMembers = [];

    this.selectionElements = {
      sectionElement: this.querySelector(".dw-members"),
      openButtonElement: this.getElementByTag("members.open-multiple-selection"),
      closeButtonElement: this.getElementByTag("members.close-multiple-selection"),
      deleteButtonElement: this.getElementByTag("members.delete"),
    };
  }

  openMultipleSelection() {
    const { sectionElement, openButtonElement, closeButtonElement, deleteButtonElement } = this.selectionElements;
    openButtonElement.setAttribute("hidden", "");
    closeButtonElement.removeAttribute("hidden");
    deleteButtonElement.removeAttribute("hidden");
    this.isSelectMultiple = true;

    sectionElement.querySelectorAll(".dw-member").forEach((memberElement) => {
      const checkboxElement = memberElement.querySelector("sl-checkbox");
      checkboxElement.classList.add("active");
    });
  }

  closeMultipleSelection() {
    const { sectionElement, openButtonElement, closeButtonElement, deleteButtonElement } = this.selectionElements;
    openButtonElement.removeAttribute("hidden");
    closeButtonElement.setAttribute("hidden", "");
    deleteButtonElement.setAttribute("hidden", "");
    this.isSelectMultiple = false;

    sectionElement.querySelectorAll(".dw-member").forEach((memberElement) => {
      const checkboxElement = memberElement.querySelector("sl-checkbox");
      checkboxElement.classList.remove("active");
      checkboxElement.checked = false;
    });
  }

  addMultipleSelectionListeners() {
    const { openButtonElement, closeButtonElement } = this.selectionElements;

    openButtonElement.addEventListener("click", () => {
      this.openMultipleSelection();
    });

    closeButtonElement.addEventListener("click", () => {
      this.closeMultipleSelection();
    });
  }

  /**
   * @param {HTMLElement} refElement
   * @param {Function} onOpen
   * @param {Function} onClose
   */
  addEditMemberDialogListener(refElement, onOpen, onClose) {
    this.onTagClick("members.select", async (model, target) => {
      if (this.isSelectMultiple) {
        const checkboxElement = target.querySelector("sl-checkbox");
        checkboxElement.checked = !checkboxElement.checked;
        return;
      }

      this.selectedMember = model;
      await onOpen(this.selectedMember);

      const attributes = {
        ...model,
        activeMember: `${model.username} (${model.did})`,
      };

      await this.ui.showDialogFromComponent("dw-dialog-edit-member", attributes, {
        parentElement: refElement,
        onClose: async () => {
          this.selectedMember = undefined;
          await onClose(undefined);
        },
      });
    });
  }

  deleteMembers(model, ..._props) {
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
}

class MembersController extends DwController {
  constructor(...props) {
    super(...props);
    const { ui } = this;
    const { selectedGroup } = this.getState();

    this.model = {
      activeUser: `${this.identity.username} (${this.identity.did})`,
      selectedGroup,
      selectedMember: undefined,
      members: [],
      areMembersLoaded: false,
    };

    ui.page = new MembersUI(...props);
    ui.page.addMultipleSelectionListeners();
    ui.page.addEditMemberDialogListener(
      this.element,
      this.onOpenEditDialog.bind(this),
      this.onCloseEditDialog.bind(this)
    );

    this.onTagClick("members.delete", async (...props) => {
      const deletedDIDs = ui.page.deleteMembers(...props);

      while (deletedDIDs.length > 0) {
        const did = deletedDIDs.pop();
        this.model.members = this.model.members.filter((member) => member.did !== did);
      }

      const w3cDID = require("opendsu").loadAPI("w3cdid");
      const groupDIDDocument = await promisify(w3cDID.resolveDID)(this.model.selectedGroup.did);
      await promisify(groupDIDDocument.removeMembers)(deletedDIDs);
      this.updateState("members", this.model.members);
      this.ui.page.closeMultipleSelection();
    });

    this.onTagClick("member.delete", async (...props) => {
      ui.page.deleteMembers(...props);
      const deletedDID = this.model.selectedMember.did;
      this.model.members = this.model.members.filter((member) => member.did !== deletedDID);
      const w3cDID = require("opendsu").loadAPI("w3cdid");
      const groupDIDDocument = await promisify(w3cDID.resolveDID)(this.model.selectedGroup.did);
      await promisify(groupDIDDocument.removeMember)(deletedDID);
      this.updateState("members", this.model.members);
    });
  }

  async onOpenEditDialog(memberData) {
    const { ui } = this;
    const { CredentialsUI } = await import("./CredentialsController.js");

    ui.dialog = {
      credentials: new CredentialsUI(),
      databases: {
        addDatabase: async () => {
          return await this.ui.submitGenericForm(this.element, "member.database.form");
        },
      },
    };

    this.model.selectedMember = {
      ...memberData,
      credentials: [],
      databases: [],
      areCredentialsLoaded: false,
      areDatabasesLoaded: false,
    };

    setTimeout(async () => {
      /* TODO: make databases to load asynchronous at this point, not after credentials */

      this.model.selectedMember.credentials = await this.fetchMemberCredentials();
      this.model.selectedMember.areCredentialsLoaded = true;

      this.model.selectedMember.databases = await this.fetchMemberDatabases();
      this.model.selectedMember.areDatabasesLoaded = true;
    }, 3000);

    this.onTagClick("member.credential.add", async () => {
      const openDSU = require("opendsu");
      const crypto = openDSU.loadAPI("crypto");
      const credential = await promisify(crypto.createCredentialForDID)(
        this.identity.did,
        this.model.selectedMember.did
      );

      this.model.selectedMember.credentials.push({
        credential,
      });

      await this.storeMemberCredential(credential);
      await utils.sendUserMessage(
        this.identity.did,
        this.model.selectedGroup,
        this.model.selectedMember,
        credential,
        constants.CONTENT_TYPE.CREDENTIAL,
        constants.RECIPIENT_TYPES.USER_RECIPIENT,
        constants.OPERATIONS.ADD
      );
    });

    this.onTagClick("member.credential.select", async (...props) => {
      await ui.dialog.copyTokenToClipboard.apply(this, props);
    });

    this.onTagClick("member.credential.inspect", async (model) => {
      // const crypto = require("opendsu").loadAPI("crypto");
      // const jsonCredential = await promisify(crypto.parseJWTSegments)(
      //     model.credential
      // );
      // jsonCredential.signature = $$.Buffer.from(
      //     jsonCredential.signature
      // ).toString("base64");
      // model.jsonCredential = JSON.stringify(jsonCredential, null, 4);
      await ui.showDialogFromComponent("dw-dialog-view-credential", model);
    });

    this.onTagClick("member.credential.delete", async (deletedCredential, ...props) => {
      console.log({ props });

      this.model.selectedMember.credentials = this.model.selectedMember.credentials.filter(
        (credential) => credential.id !== deletedCredential.id
      );

      await this.storageService.deleteRecordAsync(
        constants.TABLES.USER_CREDENTIALS,
        utils.getPKFromCredential(deletedCredential.credential)
      );
      await ui.showToast(deletedCredential);
    });

    this.onTagClick("member.database.add", async () => {
      const { name } = await ui.dialog.databases.addDatabase();
      const database = await this.createUserDatabase(name);
      this.model.selectedMember.databases.push(database);
      await this.storeUserDatabase(database);
      await utils.sendUserMessage(
        this.identity.did,
        this.model.selectedGroup,
        this.model.selectedMember,
        database,
        constants.CONTENT_TYPE.DATABASE,
        constants.RECIPIENT_TYPES.USER_RECIPIENT,
        constants.OPERATIONS.ADD
      );
    });

    this.onTagClick("member.database.delete", async (deletedDatabase, ...props) => {
      console.log({ props });

      this.model.selectedMember.databases = this.model.selectedMember.databases.filter(
        (database) => database.keySSI !== deletedDatabase.keySSI
      );

      await this.storageService.deleteRecordAsync(constants.TABLES.USER_DATABASES, deletedDatabase.keySSI);
      await ui.showToast(deletedDatabase);
    });
  }

  async storeMemberCredential(credential) {
    await this.storageService.insertRecordAsync(
      constants.TABLES.USER_CREDENTIALS,
      utils.getPKFromCredential(credential),
      {
        issuer: this.identity.did,
        credential,
        member: this.model.selectedMember.did,
      }
    );
  }

  async createUserDatabase(name) {
    const openDSU = require("opendsu");
    const dbAPI = openDSU.loadAPI("db");
    const keySSISpace = openDSU.loadAPI("keyssi");
    const seedSSI = await promisify(keySSISpace.createSeedSSI)(constants.DOMAIN);
    const db = dbAPI.getWalletDB(seedSSI, name);
    return {
      name,
      keySSI: seedSSI,
    };
  }

  async storeUserDatabase(database) {
    database.member = this.model.selectedMember;
    await this.storageService.insertRecordAsync(constants.TABLES.USER_DATABASES, database.keySSI, database);
  }

  async onCloseEditDialog() {
    this.model.selectedMember.credentials = [];
    this.model.selectedMember.areCredentialsLoaded = false;

    this.model.selectedMember.databases = [];
    this.model.selectedMember.areDatabasesLoaded = false;
  }

  /** @deprecated **/
  async fetchMemberCredentials() {
    return await this.storageService.filterAsync(
      constants.TABLES.USER_CREDENTIALS,
      `member == ${this.model.selectedMember.did}`
    );
  }

  /** @deprecated **/
  async fetchMemberDatabases() {
    return await this.storageService.filterAsync(
      constants.TABLES.USER_DATABASES,
      `member == ${this.model.selectedMember.did}`
    );
  }
}

export default MembersController;
