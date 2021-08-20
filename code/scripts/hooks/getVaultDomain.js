const openDSU = require("opendsu");
const sc = openDSU.loadAPI("sc");

const getVaultDomainAsync = $$.promisify(sc.getVaultDomain, sc);

export { getVaultDomainAsync };