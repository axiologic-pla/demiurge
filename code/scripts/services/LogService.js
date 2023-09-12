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
      ...logDetails   
    };

    if(!log.logPk){
         log.logPk = crypto.encodeBase58(crypto.generateRandom(32));
    }

    this.getSharedStorage(async (err, storageService) => {
      if (err) {
        return callback(err);
      }
    
      try{
           let existingRecord = await $$.promisify(storageService.getRecord, storageService)(this.logsTable, log.logPk);
            //duplicated logs, ignoring
            return callback(undefined, existingRecord);
        } catch(err){
        //do nothing, it was expected for new logs
      }        
            
      let batchId = await storageService.startOrAttachBatchAsync();
      try{
        
        await $$.promisify(storageService.insertRecord, storageService)(this.logsTable, log.logPk, log);
        await storageService.commitBatchAsync(batchId);
        callback(undefined, log);
      }catch (e) {
        const insertError = createOpenDSUErrorWrapper(`Failed to insert log in table ${this.logsTable}`, e);
        try {
          await storageService.cancelBatchAsync(batchId);
        } catch (error) {          
          //whatever
        }
        console.error(insertError);
          /* retry to do log so we don't lose logs because of concurrency issues or temporary network issues*/
          return this.log(logDetails, callback);          
      }
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
      if (err || !sharedEnclave) {
        return callback(err);
      }      
      this.storageService = sharedEnclave;
      callback(undefined, this.storageService);
    });
  }
}
