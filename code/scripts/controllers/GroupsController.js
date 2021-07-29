import constants from "../constants.js";

const { DwController } = WebCardinal.controllers;

class GroupsUI extends DwController {
  constructor(...props) {
    super(...props);
  }

  addBlockchainDomainListener() {
    const inputElement = this.getElementByTag("blockchain-domain");

    const nativeElement = inputElement.shadowRoot.querySelector("[part=input]");
    if (!(nativeElement instanceof HTMLElement)) return;

    const buttonElements = inputElement.querySelectorAll("sl-button");
    const [editButtonElement, saveButtonElement] = buttonElements;

    editButtonElement.addEventListener("click", (event) => {
      event.stopPropagation();
      editButtonElement.setAttribute("hidden", "");
      saveButtonElement.removeAttribute("hidden");
      inputElement.disabled = false;
      setTimeout(() => {
        nativeElement.focus();
        nativeElement.setSelectionRange(0, nativeElement.value.length);
      });
    });

    saveButtonElement.addEventListener("click", (event) => {
      event.stopPropagation();
      saveButtonElement.setAttribute("hidden", "");
      editButtonElement.removeAttribute("hidden");
      inputElement.disabled = true;
    });
  }

  addFabListener() {
    const buttonElement = document.querySelector("#groups-fab");
    buttonElement.addEventListener("click", async () => {
      await this.ui.showDialogFromComponent("dw-dialog-groups-fab");
    });

    this.model.onChange("areGroupsLoaded", () => {
      if (this.model.areGroupsLoaded) {
        buttonElement.removeAttribute("hidden");
      } else {
        buttonElement.setAttribute("hidden", "");
      }
    });
  }

  addGroupSpecificDataListener() {
    const loaderElement = this.element.parentElement;
    const parts = ["members", "credentials", "databases"];

    const elements = { templates: {}, wrappers: {} };
    for (const part of parts) {
      elements.templates[part] = loaderElement.querySelector(`template#dw-${part}--template`);
      elements.wrappers[part] = this.querySelector(`#dw-${part}`);
    }

    this.model.onChange("selectedGroup", ({ targetChain }) => {
      if (targetChain !== "selectedGroup") {
        return;
      }

      for (const part of parts) {
        elements.wrappers[part].innerHTML = "";
      }

      this.updateState("selectedGroup", this.model.selectedGroup);

      if (!this.model.selectedGroup) {
        return;
      }

      for (const part of parts) {
        const content = elements.templates[part].content.cloneNode(true);
        elements.wrappers[part].append(content);
      }
    });
  }

  selectGroup(model, target) {
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
    const { ui } = this;

    this.model = {
      blockchainDomain: constants.DOMAIN,
      groups: [],
      selectedGroup: {},
      areGroupsLoaded: false,
    };

    ui.page = new GroupsUI(...props);
    ui.page.addBlockchainDomainListener();
    ui.page.addFabListener.call(this);
    ui.page.addGroupSpecificDataListener.call(this);

    setTimeout(async () => {
      try {
        this.model.groups = await this.fetchGroups();
        this.updateState("groups", this.model.groups);
        this.model.areGroupsLoaded = true;
      } catch (err) {
        console.log(err);
      }
    });

    this.onTagClick("group.select", async (...props) => {
      const group = ui.page.selectGroup(...props);
      this.model.selectedGroup = group;
      await ui.showToast(group);
    });

    this.onTagClick("group.delete", async (deletedGroup) => {
      try {
        this.model.selectedGroup = undefined;
        await this.deleteGroup(deletedGroup.did);
        this.model.groups = this.model.groups.filter((group) => group.did !== deletedGroup.did);
        this.updateState("groups", this.model.groups);
        await ui.showToast(deletedGroup);
      } catch (err) {
        console.log(err);
      }
    });

    this.onTagClick("credential.delete", async (deletedGroupCredential) => {
      this.model.credentials = this.model.credentials.filter(
        (credential) => credential.credential !== deletedGroupCredential.credential
      );
      await this.storageService.deleteRecordAsync(
        constants.TABLES.GROUPS_CREDENTIALS,
        deletedGroupCredential.credential
      );
      this.updateState("credential", this.model.selectedGroup.credentials);
      await ui.showToast(deletedGroupCredential);
    });
  }

  async fetchGroups() {
    return await this.storageService.filterAsync(constants.TABLES.GROUPS);
  }

  async deleteGroup(did) {
    await this.storageService.deleteRecordAsync(constants.TABLES.GROUPS, did);
  }
}

export default GroupsController;
