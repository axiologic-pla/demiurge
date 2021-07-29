import { DatabasesUI } from "../groups/DatabasesController.js";
import constants from "../../constants.js";
import utils from "../../utils.js";

const { DwController } = WebCardinal.controllers;
const { promisify } = utils;

class DatabasesController extends DwController {
  constructor(...props) {
    super(...props);
    const { ui } = this;
    const { selectedGroup, selectedMember } = this.getState();

    ui.page = new DatabasesUI(...props);

    this.model = {
      selectedGroup,
      selectedMember,
      databases: [],
      areDatabasesLoaded: false,
    };

    this.onTagClick("database.add", async (...props) => {
      try {
        const { name } = await ui.page.addDatabase(...props);
        const group = this.model.selectedGroup;
        const member = this.model.selectedMember;
        const database = await this.createDatabase({ name });
        await this.storeDatabase(database);
        this.model.databases.push(database);
        await this.shareDatabase(group, member, database);
        await ui.showToast(database);
      } catch (err) {
        console.log(err);
      }
    });

    this.onTagClick("database.delete", async (deletedDatabase, ...props) => {
      try {
        console.log({ deletedDatabase, props });
        this.model.databases = this.model.databases.filter((database) => database.keySSI !== deletedDatabase.keySSI);
        await this.deleteDatabase(deletedDatabase);
        await ui.showToast(deletedDatabase);
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
    return await this.storageService.filterAsync(constants.TABLES.USER_DATABASES);
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
      keySSI: seedSSI,
    };
  }

  /**
   * @param {object} database
   * @param {string} database.keySSI
   */
  async storeDatabase(database) {
    await this.storageService.insertRecordAsync(constants.TABLES.USER_DATABASES, database.keySSI, database);
  }

  /**
   * @param {object} database
   * @param {string} database.keySSI
   */
  async deleteDatabase(database) {
    await this.storageService.deleteRecordAsync(constants.TABLES.USER_DATABASES, database.keySSI);
  }

  async shareDatabase(group, member, token) {
    await utils.sendUserMessage(
      this.identity.did,
      group,
      member,
      token,
      constants.CONTENT_TYPE.DATABASE,
      constants.RECIPIENT_TYPES.USER_RECIPIENT,
      constants.OPERATIONS.ADD
    );
  }
}

export default DatabasesController;
