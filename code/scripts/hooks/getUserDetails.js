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

export {getUserDetails};
