const openDSU = require('opendsu');
const enclaveAPI = openDSU.loadAPI('enclave');
const scAPI = openDSU.loadAPI('sc');
const resolver = openDSU.loadAPI('resolver');
const keySSISpace = openDSU.loadAPI('keyssi');

import utils from '../utils.js';
import constants from '../constants.js';

class VotingService {

  async createVotingSession(votingDetails) {
    const vaultDomain = await $$.promisify(scAPI.getVaultDomain)();
    const templateSSI = keySSISpace.createTemplateSeedSSI(vaultDomain);
    const dsuInstance = await $$.promisify(resolver.createDSU)(templateSSI);
    const dsuSSI = await $$.promisify(dsuInstance.getKeySSIAsString)();

    const enclave = enclaveAPI.initialiseWalletDBEnclave(dsuSSI);
    let enclaveSSI = await $$.promisify(enclave.getKeySSI)();
    enclaveSSI = enclaveSSI.getIdentifier(true);
    votingDetails.enclaveSSI = enclaveSSI;
    await $$.promisify(enclave.insertRecord)('', constants.TABLES.VOTING_DATA_TABLE, constants.VOTING_DATA_PK, votingDetails);
    return enclaveSSI;
  }

  async addVoteToSession(votingSessionEnclaveSSI, voteDetails) {
    const enclave = enclaveAPI.initialiseWalletDBEnclave(votingSessionEnclaveSSI);
    await $$.promisify(utils.waitForEnclave)(enclave);
    const pk = utils.getPKFromContent(utils.uuidv4());
    await $$.promisify(enclave.insertRecord)('', constants.TABLES.VOTES_LIST_TABLE, pk, voteDetails);
  }

  async getVotingSessionsDetails(votingSessionsEnclaveSSIs) {
    const votingSessionDetails = [];
    for (let index = 0; index < votingSessionsEnclaveSSIs.length; ++index) {
      const enclaveSSI = votingSessionsEnclaveSSIs[index];
      const enclave = enclaveAPI.initialiseWalletDBEnclave(enclaveSSI);
      await $$.promisify(utils.waitForEnclave)(enclave);
      const record = await $$.promisify(enclave.getRecord)('', constants.TABLES.VOTING_DATA_TABLE, constants.VOTING_DATA_PK);
      const votes = await $$.promisify(enclave.filter)('', constants.TABLES.VOTES_LIST_TABLE);
      record.votes = votes;
      console.log('[VOTING RECORD]', record, votes);
      votingSessionDetails.push(record);
    }

    return votingSessionDetails;
  }
}

let serviceInstance = null;
const getVotingServiceInstance = function() {
  if (serviceInstance) {
    return serviceInstance;
  }

  serviceInstance = new VotingService();
  return serviceInstance;
};

export { getVotingServiceInstance };