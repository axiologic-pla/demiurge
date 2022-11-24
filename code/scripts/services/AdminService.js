const openDSU = require('opendsu');
const http = openDSU.loadApi('http');

function getCompanyVars({ adminDomain, mainDomain, subDomain }) {
  return {
    companyName: subDomain,
    mainDomain: adminDomain,
    domain: `${mainDomain}.${subDomain}`,
    subDomain: `${mainDomain}.${subDomain}`,
    didDomain: `vault.${subDomain}`,
    vaultDomain: `vault.${subDomain}`
  };
}

async function storeVariable(baseUrl, adminDomain, dns, prop, value) {
  try {
    let doPost = $$.promisify(http.doPost);
    await doPost(`${baseUrl}/admin/${adminDomain}/storeVariable`, JSON.stringify({
      'dnsDomain': dns,
      'variableName': prop,
      'variableContent': value
    }));
    console.log(`Finished storing variable ${prop}=${value} for ${dns}`);
  } catch (e) {
    console.error(e);
  }
}

async function createDomain(baseUrl, adminDomain, domainName) {
  try {
    let doPost = $$.promisify(http.doPost);
    await doPost(`${baseUrl}/admin/${adminDomain}/addDomain`, JSON.stringify({
      'domainName': domainName,
      'cloneFromDomain': adminDomain
    }));
    console.log(`Finished createDomain ${domainName} based on ${adminDomain}`);
  } catch (e) {
    console.error(e);
  }
}

async function registerTemplate(baseUrl, adminDomain, path, content) {
  try {
    let doPost = $$.promisify(http.doPost);
    await doPost(`${baseUrl}/admin/${adminDomain}/registerTemplate`, JSON.stringify({
      path,
      content
    }));
    console.log(`Finished registering template for path ${path}`);
  } catch (e) {
    console.error(e);
  }
}

function getEnvironmentTemplate() {
  return 'export default {\n' +
    '      "appName": "unnamed",\n' +
    '      "companyName": "Company Inc",\n' +
    '      "vault": "server",\n' +
    '      "agent": "browser",\n' +
    '      "system":   "any",\n' +
    '      "browser":  "any",\n' +
    '      "mode":  "dev-secure",\n' +
    '      "domain": "${domain}",\n' +
    '      "didDomain": "${didDomain}",\n' +
    '      "vaultDomain": "${vaultDomain}",\n' +
    '      "stage":  "release",\n' +
    '      "enclaveType": "WalletDBEnclave",\n' +
    '      "sw": false,\n' +
    '      "pwa": false,\n' +
    '      "allowPinLogin": false\n' +
    '    }\n' +
    '    \n' +
    '    /*\n' +
    '    *  Legenda for properties\n' +
    '    *  ********************************************* NOTICE *********************************************************\n' +
    '    *  !!! domain, didDomain, vaultDomain and enclaveType must not be changed unless you know exactly what you do !!!\n' +
    '    *  ********************************************* NOTICE *********************************************************\n' +
    '    *  mode:(dev-autologin, autologin, external-autologin, mobile-autologin, secure, dev-secure)\n' +
    '    *  vault:(server, browser)\n' +
    '    *  agent:(mobile, browser)\n' +
    '    *  system:(iOS, Android, any)\n' +
    '    *  browser:(Chrome, Firefox, any)\n' +
    '    *  stage:(development, release)\n' +
    '    *  sw:(true, false)\n' +
    '    *  pwa:(true,false)\n' +
    '    *  allowPinLogin:(true,false)\n' +
    '    */';
}

export {
  getCompanyVars,
  createDomain,
  registerTemplate,
  storeVariable,
  getEnvironmentTemplate
};