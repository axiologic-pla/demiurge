import constants from "../../constants.js";
import utils from "../../utils.js";

const { DwController } = WebCardinal.controllers;
const { promisify } = utils;

class DatabasesUI extends DwController {
  constructor(...props) {
    super(...props);
  }

  async addDatabase(model, target) {
    return await this.ui.submitGenericForm(model, target);
  }
}

class DatabasesController extends DwController {
  constructor(...props) {
    super(...props);
    const { ui } = this;
    const { selectedGroup } = this.getState();

    ui.page = new DatabasesUI(...props);

    this.model = {
      selectedGroup,
      databases: [],
      areDatabasesLoaded: false,
    };

    this.onTagClick("database.add", async (...props) => {
      try {
        const { name } = await ui.page.addDatabase(...props);
        const group = this.model.selectedGroup;
        const database = await this.createDatabase({ name });
        await this.storeDatabase(database);
        this.model.databases.push(database);
        await this.shareDatabaseWithMembers(group, database);
        // await ui.showToast(database);
      } catch (err) {
        console.log(err);
      }
    });

    this.onTagClick("database.delete", async (deletedDatabase, ...props) => {
      try {
        console.log({ deletedDatabase, props });
        this.model.databases = this.model.databases.filter((database) => database.keySSI !== deletedDatabase.keySSI);
        await this.deleteDatabase(deletedDatabase);
        // await ui.showToast(deletedDatabase);
      } catch (err) {
        console.log(err);
      }
    });

    setTimeout(async () => {
      this.model.databases = await this.fetchDatabases();
      this.model.areDatabasesLoaded = true;
    });
  }

  async fetchDatabases() {
    return await this.storageService.filterAsync(constants.TABLES.GROUP_ENCLAVES);
  }

  /**
   * @param {object} database
   * @param {string} database.name
   */
  async createDatabase(database) {
    const openDSU = require("opendsu");
    const dbAPI = openDSU.loadAPI("db");
    const keySSISpace = openDSU.loadAPI("keyssi");
    const seedSSI = await promisify(keySSISpace.createSeedSSI)(constants.DOMAIN);
    const db = dbAPI.getWalletDB(seedSSI, database.name);
    return {
      name: database.name,
      keySSI: seedSSI.getIdentifier(),
    };
  }

  /**
   * @param {object} database
   * @param {string} database.keySSI
   */
  async storeDatabase(database) {
    await this.storageService.insertRecordAsync(constants.TABLES.GROUP_ENCLAVES, database.keySSI, database);
  }

  /**
   * @param {object} group
   * @param {string} group.did
   * @param database
   */
  async shareDatabaseWithMembers(group, database) {
    await utils.sendGroupMessage(
      this.identity.did,
      group,
      database,
      constants.CONTENT_TYPE.DATABASE,
      constants.RECIPIENT_TYPES.GROUP_RECIPIENT,
      constants.OPERATIONS.ADD
    );
  }

  /**
   * @param {object} database
   * @param {string} database.keySSI
   */
  async deleteDatabase(database) {
    await this.storageService.deleteRecordAsync(constants.TABLES.GROUP_ENCLAVES, database.keySSI);
  }
}

export default DatabasesController;
export { DatabasesUI };
