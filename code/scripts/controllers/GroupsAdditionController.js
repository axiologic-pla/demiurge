import constants from "../constants.js";

const { DwController } = WebCardinal.controllers;
import utils from "../utils.js";

const promisify = utils.promisify;

class GroupFabUI extends DwController {
  constructor(...props) {
    super(...props);
  }

  async addGroup() {
    return await this.ui.submitGenericForm(this.element, "group.form");
  }

  async addMember() {
    return await this.ui.submitGenericForm(this.element, "member.form");
  }

  async addDatabase() {
    return await this.ui.submitGenericForm(this.element, "database.form");
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
          return { did };
        }
        throw Error("Coping from clipboard is not possible!");
      } catch (err) {
        target.remove();
        console.log(err);
        return "";
      }
    });
  }
}

class GroupsAdditionController extends DwController {
  constructor(...props) {
    super(...props);
    const { ui } = this;
    const { selectedGroup, groups } = this.getState();

    this.model = {
      showSelectedGroup: typeof selectedGroup !== "undefined",
      groups,
    };

    if (this.model.showSelectedGroup) {
      const { members, credentials, databases } = this.getState();

      this.model = {
        ...this.model,
        activeGroup: `${selectedGroup.name} (${selectedGroup.did})`,
        selectedGroup,
        members,
        credentials,
        databases,
      };
    }

    ui.page = new GroupFabUI(...props);
    ui.page.addPasteMemberDIDFromClipboardListener();

    this.onTagClick("group.add", async (...props) => {
      try {
        const { name } = await ui.page.addGroup(...props);
        const group = await this.storeGroup({ name });
        this.model.groups.push(group);
        this.removeFromState("selectedGroup");
        await this.ui.hideDialogFromComponent("dw-dialog-groups-fab");
        await this.ui.showToast(group);
      } catch (err) {
        console.log(err);
      }
    });

    this.onTagClick("member.add", async (...props) => {
      const w3cDID = require("opendsu").loadAPI("w3cdid");
      try {
        const { did } = await ui.page.addMember(...props);

        const didDocument = await promisify(w3cDID.resolveDID)(did);
        const username = didDocument.getName();
        const member = await this.storeMember(this.model.selectedGroup, {
          did,
          username,
        });
        await this.notifyMember(this.model.selectedGroup, member);
        this.model.members.push(member);
        this.updateState("members", this.model.members);
        await this.ui.hideDialogFromComponent("dw-dialog-groups-fab");
        await this.ui.showToast(member);
      } catch (err) {
        console.log(err);
      }
    });

    this.onTagClick("database.add", async (...props) => {
      const { name } = await ui.page.addDatabase(...props);
      const database = await this.createDatabase(name);
      await this.storeGroupDatabase(database);
      this.model.databases.push(database);
      await this.shareGroupDatabaseWithMembers(this.model.selectedGroup, database);
      await this.ui.hideDialogFromComponent("dw-dialog-groups-fab");
      await this.ui.showToast(database);
    });

    this.onTagClick("credential.add", async () => {
      const credential = await this.generateGroupCredential(this.model.selectedGroup);
      if (!this.model.credentials) {
        this.model.credentials = [];
      }
      this.model.credentials.push({ credential });
      await this.storeGroupCredential(this.model.selectedGroup, credential);
      await this.shareGroupCredentialWithMembers(this.model.selectedGroup, credential);
      await this.ui.hideDialogFromComponent("dw-dialog-groups-fab");
      await this.ui.showToast(credential);
    });
  }

  async createDatabase(name) {
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

  async storeGroupDatabase(database) {
    await this.storageService.insertRecordAsync(constants.TABLES.GROUP_DATABASES, database.keySSI, database);
  }

  /**
   * @param {object} group
   * @param {string} group.name
   */
  async storeGroup(group) {
    const w3cdid = require("opendsu").loadAPI("w3cdid");
    const groupDIDDocument = await promisify(w3cdid.createIdentity)("group", constants.DOMAIN, group.name);
    group.did = groupDIDDocument.getIdentifier();
    await this.storageService.insertRecordAsync(constants.TABLES.GROUPS, group.did, group);
    await promisify(groupDIDDocument.addMember)(this.identity.did, this.identity);
    return group;
  }

  /**
   * @param {object} group
   * @param {string} group.did
   * @param {object} member
   * @param {string} member.did
   * @param {string} member.username
   * @param {string} member.email
   * @param {string} [member.address]
   */
  async storeMember(group, member) {
    const w3cdid = require("opendsu").loadAPI("w3cdid");
    let groupDIDDocument = await promisify(w3cdid.resolveDID)(group.did);
    await promisify(groupDIDDocument.addMember)(member.did, member);

    return member;
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

  /**
   * @param {object} group
   * @param {string} group.did
   */
  async generateGroupCredential(group) {
    const crypto = require("opendsu").loadAPI("crypto");
    const groupCredential = await promisify(crypto.createCredentialForDID)(this.identity.did, group.did);

    return groupCredential;
  }

  async storeGroupCredential(group, credential) {
    await this.storageService.insertRecordAsync(
      constants.TABLES.GROUPS_CREDENTIALS,
      utils.getPKFromCredential(credential),
      {
        groupDID: group.did,
        credential,
      }
    );
  }

  /**
   * @param {object} group
   * @param {string} group.did
   * @param {string} groupCredential
   */
  async shareGroupCredentialWithMembers(group, groupCredential) {
    await utils.sendGroupMessage(
      this.identity.did,
      group,
      groupCredential,
      constants.CONTENT_TYPE.CREDENTIAL,
      constants.RECIPIENT_TYPES.GROUP_RECIPIENT,
      constants.OPERATIONS.ADD
    );
  }

  async shareGroupDatabaseWithMembers(group, database) {
    await utils.sendGroupMessage(
      this.identity.did,
      group,
      database,
      constants.CONTENT_TYPE.DATABASE,
      constants.RECIPIENT_TYPES.GROUP_RECIPIENT,
      constants.OPERATIONS.ADD
    );
  }
}

export default GroupsAdditionController;
