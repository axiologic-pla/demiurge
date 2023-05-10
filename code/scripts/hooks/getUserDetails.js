import constants from "./../constants.js";
import utils from "../utils.js";
import {getStoredDID} from "./../services/BootingIdentityService.js";

async function getUserDetails() {
  const response = await fetch("./api-standard/user-details");
  let jsonResult = await response.json();
  let returnResult = jsonResult.username.replace(/@/gm, '/');
  const openDSU = require("opendsu");
  const config = openDSU.loadAPI("config");
  let appName = await $$.promisify(config.getEnv)("appName");
  return {
    userAppDetails: `${appName || "-"}/${returnResult}`,
    userName: jsonResult.username
  }
}

async function getUserInfo() {
  const openDSU = require("opendsu");
  const scAPI = openDSU.loadAPI("sc");
  const w3cdid = openDSU.loadAPI("w3cdid");
  let userInfo;
  try {
    let sharedEnclave = await $$.promisify(scAPI.getSharedEnclave)()
    let groups = await utils.promisify(sharedEnclave.filter)(constants.TABLES.GROUPS);
    let adminGroup = groups.find((gr) => gr.accessMode === constants.ADMIN_ACCESS_MODE || gr.name === constants.EPI_ADMIN_GROUP_NAME) || {};
    if (!adminGroup) {
      throw new Error("Admin group not created yet.")
    }
    const groupDIDDocument = await $$.promisify(w3cdid.resolveDID)(adminGroup.did);
    let did = await getStoredDID();
    if (did) {
      userInfo = await $$.promisify(groupDIDDocument.getMemberInfo)(did);
    }

  } catch (e) {
    throw createOpenDSUErrorWrapper("Unable to get user rights!", new Error("User is not present in any group."), "security");
  }
  return userInfo;

}

export {getUserDetails, getUserInfo};
