import constants from "../constants.js";

export default class LogService {

  constructor(logsTable) {
    if (typeof logsTable === "undefined") {
      this.logsTable = constants.TABLES.LOGS_TABLE;
    } else {
      this.logsTable = logsTable;
    }
  }

  log(logDetails, callback) {
    if (logDetails === null || logDetails === undefined) {
      return;
    }
    const crypto = require("opendsu").loadAPI("crypto");
    let log = {
      ...logDetails,
      logPk: crypto.encodeBase58(crypto.generateRandom(32))
    };

    this.getSharedStorage((err, storageService) => {
      if (err) {
        return callback(err);
      }

      storageService.insertRecord(this.logsTable, log.logPk, log, (err) => {
        if (err) {
          return callback(err);
        }
        callback(undefined, log);
      });
    })
  }

  getLogs(callback) {
    this.getSharedStorage((err, storageService) => {
      if (err) {
        return callback(err);
      }
      storageService.filter(this.logsTable, "__timestamp > 0", callback);
    });
  }

  getSharedStorage(callback) {
    if (typeof this.storageService !== "undefined") {
      return callback(undefined, this.storageService);
    }
    const openDSU = require("opendsu");
    const scAPI = openDSU.loadAPI("sc");
    scAPI.getSharedEnclave((err, sharedEnclave) => {
      if (err) {
        return callback(err);
      }

      this.storageService = sharedEnclave;
      callback(undefined, this.storageService);
    });
  }
}
