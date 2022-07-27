import {removeMemberFromGroup} from "./utils.js";

function checkIfDeactivateMemberMessage(message) {
  return message.messageType === "DeactivateMember";
}

async function deactivateMember(message) {
  const openDSU = require("opendsu");
  const system = openDSU.loadAPI("system");
  const config = openDSU.loadAPI("config");
  const crypto = openDSU.loadAPI("crypto");
  const http = openDSU.loadAPI("http");

  await removeMemberFromGroup.call(this, message);
  const appName = await $$.promisify(config.getEnv)("appName");
  const did = crypto.encodeBase58(message.memberDID);
  let url = `${system.getBaseURL()}/deactivateSSOSecret/${appName}/${did}`;
  await http.fetch(url, {method: "DELETE"});
}

require("opendsu").loadAPI("m2dsu").defineMapping(checkIfDeactivateMemberMessage, deactivateMember);
export {deactivateMember}
