const openDSU = require('opendsu');
const scAPI = openDSU.loadAPI('sc');

async function getEnvironmentDataAsync() {
  try {
    const mainDSU = await $$.promisify(scAPI.getMainDSU)();
    const environmentData = await $$.promisify(mainDSU.readFile)('/environment.json');
    return JSON.parse(environmentData.toString());
  } catch (e) {
    return null;
  }
}

export { getEnvironmentDataAsync };