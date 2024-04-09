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
                throw Error("Copying from clipboard is not possible!");
            } catch (err) {
                target.remove();
                this.notificationHandler.reportUserRelevantInfo("Failed to read data from clipboard", err);
                return "";
            }
        });
    }

    // methods

    /*

      async addMember(model, target) {
        return await this.ui.submitGenericForm(model, target);
      }
    */

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
            hasRecoveryOption: selectedGroup.accessMode === "write",
            selectedMember: undefined,
            members: [],
            areMembersLoaded: false,
        };

        let managedFeaturesArr = Object.keys(this.managedFeatures);
        for (let i = 0; i < managedFeaturesArr.length; i++) {
            this.model[managedFeaturesArr[i]] = this.managedFeatures[managedFeaturesArr[i]];
        }
        ui.page = new MembersUI(...props);
        ui.page.addPasteMemberDIDFromClipboardListener();

        this.element.addEventListener("copy-paste-change", (e) => {
            if (e.detail.value && e.detail.value.trim()) {
                document.querySelector(".add-member-button").disabled = false;
            } else {
                document.querySelector(".add-member-button").disabled = true;
            }
        })

        this.onTagClick("member.add", async (model, button) => {
            if (document.querySelector(".add-member-button").disabled) {
                return
            }
            let inputElement = document.querySelector("#add-member-input");

            const newMemberDid = inputElement.value;
            this.updateMemebersModal = this.showModalFromTemplate("dw-dialog-group-members-update/template", () => {
            }, () => {
            }, {
                model: {
                    action: "Adding",
                    did: newMemberDid
                },
                disableClosing: false,
                showCancelButton: false,
                disableExpanding: true,
                disableFooter: true,
                disableHeader: true
            })

            document.querySelector(".add-member-button").disabled = true

            try {
                if (!newMemberDid) {
                    throw new Error("DID is empty.");
                }

                inputElement.value = "";
                let groups = await utils.fetchGroups();
                let selectedGroup = constants.EPI_GROUP_TAGS.find(group => group.name === this.model.selectedGroup.name);
                if (!selectedGroup) {
                    selectedGroup = groups.find(group => group.name === this.model.selectedGroup.name);
                }
                selectedGroup.did = this.model.selectedGroup.did;

                let hasGroupTag = selectedGroup.tags.split(',').findIndex(tag => newMemberDid.toLowerCase().includes(tag.trim().toLowerCase())) !== -1;
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


                const member = await this.addMember(selectedGroup, {did: newMemberDid});
                this.model.members.push(member);

            } catch (e) {
                this.notificationHandler.reportUserRelevantError("Could not add user to the group because: ", e)
            }

            button.loading = false;

            if (this.updateMemebersModal) {
                this.updateMemebersModal.destroy();
            }
        });

        this.onTagClick("member.select", (selectedMember) => {
            this.model.selectedMember = selectedMember;
            ui.page.loadMemberPage({selectedGroup, selectedMember});
        });

        this.onTagClick("member.delete", async (model, target) => {
            if (target.disabled) {
                return
            }
            target.disabled = true;
            let targetContent = target.innerHTML;
            target.innerHTML = `<i class="fa fa-circle-o-notch fa-spin" style="font-size:24px; top: 25%; position:relative; color: var(--dw-app-disabled-color);"></i>`
            if (model.did !== this.did) {
                await removeGroupMember(model.did, constants.OPERATIONS.REMOVE)
            } else {
                await ui.showToast("You tried to delete your account. This operation is not allowed.", constants.NOTIFICATION_TYPES.ERROR);
            }
            target.innerHTML = targetContent;
            target.disabled = false;

            // ui.page.closeMultipleSelection();
        });

        this.onTagClick("member.deactivate", async (model) => {
            await removeGroupMember(model.did, constants.OPERATIONS.DEACTIVATE)
            // ui.page.closeMultipleSelection();
        });
        let removeGroupMember = async (did, operation) => {

            this.updateMemebersModal = this.showModalFromTemplate("dw-dialog-group-members-update/template", () => {
            }, () => {
            }, {
                model: {
                    action: operation === constants.OPERATIONS.REMOVE ? "Deleting" : "Deactivating",
                    did: did,
                },
                disableClosing: false,
                showCancelButton: false,
                disableExpanding: true,
                disableFooter: true,
                disableHeader: true
            })

            let undeleted = await this.deleteMembers(this.model.selectedGroup, did, operation);
            /*  await ui.hideDialogFromComponent("dw-dialog-group-members-update");*/
            this.updateMemebersModal.destroy();
            if (undeleted.length > 0) {
                await ui.showToast("Member could not be deleted", constants.NOTIFICATION_TYPES.ERROR);
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
                    let result = members.map((member) => {
                        member["enable_deactivate_group_member_feature"] = this.model.enable_deactivate_group_member_feature;
                        return member;
                    })
                    return resolve(result);
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
        const w3cDID = require("opendsu").loadAPI("w3cdid");
        const didDocument = await promisify(w3cDID.resolveDID)(member.did);
        member["username"] = didDocument.getName();
        const addMemberToGroupMessage = {
            messageType: constants.MESSAGE_TYPES.ADD_MEMBER_TO_GROUP,
            groupDID: group.did,
            enclaveName: group.enclaveName,
            accessMode: group.accessMode,
            memberDID: member.did,
            memberName: member.username,
            auditData: {
                action: constants.OPERATIONS.ADD,
                userGroup: utils.getGroupName(group),
                userDID: member.did
            }
        };

        let undigestedMessages = [];
        const messages = [addMemberToGroupMessage];
        try {
            undigestedMessages = await $$.promisify(MessagesService.processMessagesWithoutGrouping)(messages);
        } catch (e) {
            throw Error('Failed to add member');
        }

        if (undigestedMessages && undigestedMessages.length > 0) {
            throw Error('Failed to add member');
        }
        return member;
    }

    /**
     * @param {object} group
     * @param {string} group.did
     * @param {array<{did: string}>} members
     */
    async deleteMembers(group, memberDID, operation) {
        let deleteMembersMsg = {
            messageType: operation === constants.OPERATIONS.REMOVE ? constants.MESSAGE_TYPES.USER_REMOVED : "DeactivateMember",
            groupDID: group.did,
            memberDID: memberDID,
            groupName: group.name,
            accessMode: group.accessMode,
            auditData: {
                action: operation === constants.OPERATIONS.REMOVE ? constants.OPERATIONS.REMOVE : constants.OPERATIONS.DEACTIVATE,
                userGroup: utils.getGroupName(group),
                userDID: memberDID
            }
        };

        let undigestedMessages = [];
        const messages = [deleteMembersMsg];
        try {
            undigestedMessages = await $$.promisify(MessagesService.processMessagesWithoutGrouping)(messages);
        } catch (e) {
            return messages
        }

        if (undigestedMessages && undigestedMessages.length > 0) {
            return undigestedMessages.map(msg => {
                return {did: msg.memberDID}
            });
        } else {
            return [];
        }
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
