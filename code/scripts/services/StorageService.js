const DB_NAME = "myDB";
import constants from "../constants.js";

class StorageService {
  constructor() {
    let openDSU = require("opendsu");
    let sc = openDSU.loadAPI("sc").getSecurityContext();
    sc.getDB((err, db)=>{
      if (err) {
        return console.log(err);
      }

      this.mydb = db;
    })
  }

  waitForDb(func, args) {
    func = func.bind(this);
    setTimeout(function () {
      func(...args);
    }, 10);
  }

  dbReady() {
    return this.mydb !== undefined;
  }

  filter(tableName, query, sort, limit, callback) {
    if (this.dbReady()) {
      this.mydb.filter(tableName, query, sort, limit, callback);
    } else {
      this.waitForDb(this.filter, [tableName, query, sort, limit, callback]);
    }
  }

  getRecord(tableName, key, callback) {
    if (this.dbReady()) {
      this.mydb.getRecord(tableName, key, callback);
    } else {
      this.waitForDb(this.getRecord, [tableName, key, callback]);
    }
  }

  insertRecord(tableName, key, record, callback) {
    if (this.dbReady()) {
      this.mydb.insertRecord(tableName, key, record, callback);
    } else {
      this.waitForDb(this.insertRecord, [tableName, key, record, callback]);
    }
  }

  updateRecord(tableName, key, record, callback) {
    if (this.dbReady()) {
      this.mydb.updateRecord(tableName, key, record, callback);
    } else {
      this.waitForDb(this.updateRecord, [tableName, key, record, callback]);
    }
  }

  deleteRecord(tableName, key, callback) {
    if (this.dbReady()) {
      this.mydb.deleteRecord(tableName, key, callback);
    } else {
      this.waitForDb(this.deleteRecord, [tableName, key, callback]);
    }
  }

  beginBatch() {
    if (this.dbReady()) {
      this.mydb.beginBatch();
    } else {
      this.waitForDb(this.beginBatch);
    }
  }

  cancelBatch(callback) {
    if (this.dbReady()) {
      this.mydb.cancelBatch(callback);
    } else {
      this.waitForDb(this.cancelBatch, [callback]);
    }
  }

  commitBatch(callback) {
    if (this.dbReady()) {
      this.mydb.commitBatch(callback);
    } else {
      this.waitForDb(this.commitBatch, [callback]);
    }
  }

  on(eventName, callback) {
    if (this.dbReady()) {
      this.mydb.on(eventName, callback);
    } else {
      this.waitForDb(this.on, [eventName, callback]);
    }
  }

  off(eventName, callback) {
    if (this.dbReady()) {
      this.mydb.off(eventName, callback);
    } else {
      this.waitForDb(this.off, [eventName, callback]);
    }
  }

  removeAllObservers(eventName) {
    if (this.dbReady()) {
      this.mydb.removeAllObservers(eventName);
    } else {
      this.waitForDb(this.removeAllObservers, [eventName]);
    }
  }
}

export default function getStorageService(dsuStorage) {
  if (typeof window.storageServiceSingleton === "undefined") {
    window.storageServiceSingleton = new StorageService(dsuStorage);
  }

  return window.storageServiceSingleton;
}
