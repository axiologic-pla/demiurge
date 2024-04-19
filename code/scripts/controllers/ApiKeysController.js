import constants from "../constants.js";

const openDSU = require("opendsu");
const scAPI = openDSU.loadAPI("sc");
const crypto = require("opendsu").loadAPI("crypto");
const maskCharacter = '*';
const {DwController} = WebCardinal.controllers;

class ApiKeysController extends DwController {
  constructor(...props) {
    super(...props);
    const {ui} = this;

    this.model = {
      "api-keys": [],
      "api-key-name-input": ""
    };

    this.model.onChange("api-key-name-input", () => {

      if (!this.model["api-key-name-input"]) {
        this.element.querySelector("#generate-key-div button").disabled = true;
        return;
      }

      let nameAlreadyExists = this.model["api-keys"].find(elem => elem["api-key-name"] === this.model["api-key-name-input"])

      if (nameAlreadyExists) {
        this.element.querySelector("#generate-key-div button").disabled = true;
        ui.showToast("An api key with this name is already saved");
        return
      }
      this.element.querySelector("#generate-key-div button").disabled = false;
    })

    this.onTagClick("generate-api-key", async () => {
      this.model["generated-api-key"] = crypto.encodeBase58(crypto.generateRandom(32));
      let apiKeyObj = {
        name: this.model["api-key-name-input"],
        key: this.model["generated-api-key"]
      }
      let pk = crypto.sha256(crypto.generateRandom(32));
      let batchId = await $$.promisify(this.enclaveDB.safeBeginBatch)();
      let record = await this.enclaveDB.insertRecordAsync(constants.TABLES.API_KEYS_TABLE, pk, apiKeyObj);
      await $$.promisify(this.enclaveDB.commitBatch)(batchId);
      this.element.querySelector(".copy-container").removeAttribute("hidden");
      this.model["api-keys"].push(this.getApiKeysTableItem(record));
      this.model["api-key-name-input"] = "";
    })

    this.onTagClick("api-key-delete", async (model) => {
      let batchId = await $$.promisify(this.enclaveDB.safeBeginBatch)();
      await this.enclaveDB.deleteRecordAsync(constants.TABLES.API_KEYS_TABLE, model["api-key-id"]);
      await $$.promisify(this.enclaveDB.commitBatch)(batchId);
      this.model["api-keys"] = this.model["api-keys"].filter(item => item["api-key-id"] !== model["api-key-id"]);
      if (this.model["api-keys"].length === 0) {
        this.element.querySelector(".copy-container").setAttribute("hidden", true);
      }
    })

    setTimeout(async () => {
      this.enclaveDB = await $$.promisify(scAPI.getMainEnclave)();
      const apiKeys = await $$.promisify(this.enclaveDB.filter)(constants.TABLES.API_KEYS_TABLE, "__timestamp > 0");
      await this.renderApiKeysTable(apiKeys);
    });
  }

  async renderApiKeysTable(apiKeys) {
    this.model["api-keys"] = apiKeys.map(item => {
      return this.getApiKeysTableItem(item)
    })
    this.model.noApiKeys = this.model["api-keys"].length === 0;
  }

  getApiKeysTableItem(record) {
    return {"api-key-id": record.pk, "api-key-name": record.name, "api-key-mask": this.maskApiKey(record.key)}
  }

  maskApiKey(apiKey) {
    // Mask all characters except the last 4
    let visiblePart = apiKey.slice(0, 6);
    let maskedPart = apiKey.slice(6).replace(/./g, maskCharacter);
    return visiblePart + maskedPart;
  }

}

export default ApiKeysController;
