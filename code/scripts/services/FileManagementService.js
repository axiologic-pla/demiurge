const openDSU = require('opendsu');
const resolver = openDSU.loadAPI('resolver');
const keySSISpace = openDSU.loadAPI('keyssi');
const scAPI = openDSU.loadAPI('sc');

export default class FileManagementService {

  constructor() {
    this.file = null;
  }

  async prepareDownloadFromDsu(keySSI, fileName) {
    return new Promise(async (resolve, reject) => {

      try {
        const buffer = await this._readFileFromDsu(keySSI, fileName);
        const blob = new Blob([buffer]);
        this.file = {
          fileName,
          rawBlob: blob,
          mimeType: blob.type
        };
      } catch (e) {
        reject(new Error('File not found'));
      }

      resolve();
    });
  }

  async _readFileFromDsu(dsuSSI, filePath) {
    const dsuInstance = await $$.promisify(resolver.loadDSU)(dsuSSI);
    const fileContent = await $$.promisify(dsuInstance.readFile)(filePath);
    return fileContent;
  }

  downloadFileToDevice = (file) => {
    if (!file) {
      file = this.file;
    }

    window.URL = window.URL || window.webkitURL;
    if (window.navigator && window.navigator.msSaveOrOpenBlob) {
      const fileBlob = new File([file.rawBlob], file.fileName);
      window.navigator.msSaveOrOpenBlob(fileBlob);
      return;
    }

    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(file.rawBlob);
    link.download = file.fileName;
    link.click();
  };

  async writeFileToDsu(dsuSSI, filePath, data) {
    if (!data) {
      data = filePath;
      filePath = dsuSSI;
      dsuSSI = null;
    }

    let dsuInstance;
    if (!dsuSSI) {
      const vaultDomain = await $$.promisify(scAPI.getVaultDomain)();
      const templateSSI = keySSISpace.createTemplateSeedSSI(vaultDomain);
      dsuInstance = await $$.promisify(resolver.createDSU)(templateSSI);
      dsuSSI = await $$.promisify(dsuInstance.getKeySSIAsString)();
    } else {
      dsuInstance = await $$.promisify(resolver.loadDSU)(dsuSSI);
    }

    await this._uploadFile(dsuInstance, filePath, data);
    return dsuSSI;
  }

  getFileContentAsText(file, callback) {
    let fileReader = new FileReader();
    fileReader.onload = function() {
      let arrayBuffer = fileReader.result;
      callback(undefined, arrayBuffer);
    };

    fileReader.readAsText(file);
  }

  getFileContentAsBuffer(file, callback) {
    let fileReader = new FileReader();
    fileReader.onload = function() {
      let arrayBuffer = fileReader.result;
      callback(undefined, arrayBuffer);
    };

    fileReader.readAsArrayBuffer(file);
  }

  _uploadFile(dsuInstance, path, file) {
    return new Promise((resolve, reject) => {
      this.getFileContentAsBuffer(file, (err, arrayBuffer) => {
        if (err) {
          return reject('Could not get file as a Buffer');
        }

        dsuInstance.writeFile(path, $$.Buffer.from(arrayBuffer), undefined, (err) => {
          if (err) {
            return reject(new Error(err));
          }
          resolve();
        });
      });
    });
  }
}