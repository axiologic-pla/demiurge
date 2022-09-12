import constants from "../constants.js";

const {DataSource} = WebCardinal.dataSources;

const {DwController} = WebCardinal.controllers;

class LogsDataSource extends DataSource {
  constructor(...props) {
    const [customOptions, ...defaultOptions] = props;
    super(...defaultOptions);
    this.itemsOnPage = 15;
    this.dsuStorage = customOptions.dsuStorage;
    this.tableName = customOptions.tableName;
    this.searchField = customOptions.searchField;
    this.setPageSize(this.itemsOnPage);
    this.dataSourceRezults = [];
    this.hasMoreLogs = false;
    this.filterResult = [];
    this.sharedEnclaveDB = null;
  }

  async getSharedEnclave() {
    if (!this.sharedEnclaveDB) {
      const openDSU = require("opendsu");
      const scAPI = openDSU.loadAPI("sc");
      this.sharedEnclaveDB = await $$.promisify(scAPI.getSharedEnclave)();
    }
    return;
  }

  async searchHandler(inputValue, foundIcon, notFoundIcon) {
    notFoundIcon.style.display = "none";
    foundIcon.style.display = "none";
    try {
      await this.getSharedEnclave();
      if (inputValue) {
        await $$.promisify(this.sharedEnclaveDB.refresh.bind(this.sharedEnclaveDB))();
        let result = await $$.promisify(this.sharedEnclaveDB.filter.bind(this.sharedEnclaveDB))(this.tableName, `${this.searchField} == ${inputValue}`, "dsc");

        if (result && result.length > 0) {
          foundIcon.style.display = "inline";
          this.filterResult = result;
          this.forceUpdate(true);
        } else {
          notFoundIcon.style.display = "inline";
        }
      } else {
        this.filterResult = [];
        this.forceUpdate(true);
      }
    } catch (e) {
      console.log("Error on filter async page data  ", e);
    }

  }

  getMappedResult(data) {
    return data.map(item => {
      item._date = new Date(item.__timestamp).toISOString();
      return item
    })
  }

  async getPageDataAsync(startOffset, dataLengthForCurrentPage) {
    if (this.filterResult.length > 0) {
      document.querySelector(".pagination-container").hidden = true;
      return this.getMappedResult(this.filterResult);
    }
    let resultData = [];

    try {
      await this.getSharedEnclave();
      if (this.dataSourceRezults.length > 0) {
        let moreItems = await $$.promisify(this.sharedEnclaveDB.filter.bind(this.sharedEnclaveDB))(this.tableName, `__timestamp < ${this.dataSourceRezults[this.dataSourceRezults.length - 1].__timestamp}`, "dsc", this.itemsOnPage);
        if (moreItems && moreItems.length > 0 && moreItems[moreItems.length - 1].pk !== this.dataSourceRezults[this.dataSourceRezults.length - 1].pk) {
          this.dataSourceRezults = [...this.dataSourceRezults, ...moreItems,];
        }
      } else {
        await $$.promisify(this.sharedEnclaveDB.refresh.bind(this.sharedEnclaveDB))();
        this.dataSourceRezults = await $$.promisify(this.sharedEnclaveDB.filter.bind(this.sharedEnclaveDB))(this.tableName, "__timestamp > 0", "dsc", this.itemsOnPage * 2);
      }
      this.dataSourceRezults.length > this.itemsOnPage ? document.querySelector(".pagination-container").hidden = false : document.querySelector(".pagination-container").hidden = true;
      resultData = this.dataSourceRezults.slice(startOffset, startOffset + dataLengthForCurrentPage);
      this.hasMoreLogs = this.dataSourceRezults.length >= startOffset + dataLengthForCurrentPage + 1;

      if (!this.hasMoreLogs) {
        document.querySelector(".pagination-container .next-page-btn").disabled = true;
      } else {
        document.querySelector(".pagination-container .next-page-btn").disabled = false;
      }

    } catch (e) {
      console.log("Error on get async page data  ", e);
    }

    if (resultData.length === 0) {
      document.querySelector(".search-container").hidden = true;
    }

    return this.getMappedResult(resultData);
  }

}

class AuditController extends DwController {
  constructor(...props) {
    super(...props);
    const {ui} = this;

    this.model = {
      did: this.did, domain: this.domain,
    };

    this.model.logsDataSource = new LogsDataSource({
      dsuStorage: this.DSUStorage,
      tableName: constants.TABLES.LOGS_TABLE,
      searchField: "userId"
    });
    this.attachHandlers();
  }

  attachHandlers() {
    let searchInput = this.querySelector("#code-search");
    let foundIcon = this.querySelector(".fa-check");
    let notFoundIcon = this.querySelector(".fa-ban");
    if (searchInput) {
      searchInput.addEventListener("search", async (event) => {
        await this.model.logsDataSource.searchHandler(event.target.value, foundIcon, notFoundIcon)
      })
    }


    this.onTagClick("prev-page", (model, target, event) => {
      target.parentElement.querySelector(".next-page-btn").disabled = false;
      this.model.logsDataSource.goToPreviousPage();
      if (this.model.logsDataSource.getCurrentPageIndex() === 1) {
        target.parentElement.querySelector(".prev-page-btn").disabled = true;
      }

    })
    this.onTagClick("next-page", (model, target, event) => {

      target.parentElement.querySelector(".prev-page-btn").disabled = false;
      if (this.model.logsDataSource.hasMoreLogs) {
        this.model.logsDataSource.goToNextPage();
      }

    })
  }
}

export default AuditController;
