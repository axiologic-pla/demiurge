import constants from "../constants.js";
import utils from "../utils.js";
const { DwController } = WebCardinal.controllers;

class DatabasesController extends DwController {
  constructor(...props) {
    super(...props);
    const { ui } = this;
    const { selectedGroup } = this.getState();

    this.model = {
      selectedGroup,
      databases: [],
      areDatabasesLoaded: false,
    };

    this.model.onChange("databases", () => {
      this.updateState("databases", this.model.databases);
    });

    setTimeout(async () => {
      this.model.databases = await this.fetchGroupDatabases();
      this.model.areDatabasesLoaded = true;
    }, 1000);

    this.onTagClick("database.delete", async (deletedDatabase, ...props) => {
      console.log({ props });

      this.model.databases = this.model.databases.filter((database) => database.id !== deletedDatabase.id);

      await this.storageService.deleteRecordAsync(constants.TABLES.GROUP_ENCLAVES, deletedDatabase.keySSI);

      // await ui.showToast(deletedDatabase);
    });
  }

  async fetchGroupDatabases() {
    return await this.storageService.filterAsync(constants.TABLES.GROUP_ENCLAVES);
  }
}

export default DatabasesController;
