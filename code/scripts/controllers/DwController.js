import {getStoredDID} from "../services/BootingIdentityService.js";
import utils from "../utils.js";
import constants from "../constants.js";

const {WebcController} = WebCardinal.controllers;
import {getPermissionsWatcher} from "./../services/PermissionsWatcher.js";

class DwController extends WebcController {
  constructor(...props) {
    super(...props);
    this._ui = new DwUI(...props);
    this._ui.enableMenu()
    if (!$$.history) {
      $$.history = props[1];
    }
    for (const item of ["did", "userDetails", "userName", "status", "managedFeatures", "messageProcessingService"]) {
      this[item] = WebCardinal.wallet[item];
    }
    this.domain = WebCardinal.wallet.vaultDomain;
    const openDSU = require("opendsu");
    this.notificationHandler = openDSU.loadAPI("error");
    setTimeout(()=>{
      this.initPermissionsWatcher();
    }, 0);
  }

  initPermissionsWatcher(){
    getPermissionsWatcher();
  }

  get ui() {
    return this._ui;
  }

  /**
   * @deprecated
   */
  get identity() {
    return {
      did: this.did,
      username: this.userDetails.username
    }
  }

  get domain() {
    return WebCardinal.wallet.blockchainDomain;
  }

  set domain(blockchainDomain) {
    WebCardinal.wallet.blockchainDomain = blockchainDomain;
  }

  get did() {
    return WebCardinal.wallet.did;
  }

  set did(did) {
    WebCardinal.wallet.did = did;
  }

  get groupName() {
    return WebCardinal.wallet.groupName;
  }

  set groupName(groupName) {
    WebCardinal.wallet.groupName = groupName;
  }

  /**
   * @param {string} key
   * @param {object} value
   */
  updateState(key, value) {
    this.setState({
      ...(this.getState() || {}),
      [key]: value,
    });
  }

  /**
   * @param {string} key
   */
  removeFromState(key) {
    const state = this.getState();
    delete state[key];
    this.setState(state);
  }

  /**
   * @param {Function} callback
   */
  waitForSharedEnclave(callback) {
    const scApi = require('opendsu').loadApi('sc');
    scApi.getSharedEnclave((err, sharedEnclave) => {
      if (err) {
        return setTimeout(() => {
          console.log("Waiting for shared enclave .....");
          this.waitForSharedEnclave(callback);
        }, 100);
      }

      callback(undefined, sharedEnclave);
    });
  }
}

async function setupDefaultModel(userData) {
  WebCardinal.wallet = {};
  const wallet = WebCardinal.wallet;

  const {getVaultDomainAsync} = await import("../hooks/getVaultDomain.js");

  wallet.vaultDomain = await getVaultDomainAsync();

  wallet.userDetails = userData.userAppDetails;
  wallet.userName = userData.userName;

  wallet.did = await getStoredDID();
  wallet.status = await utils.getWalletStatus();
  wallet.managedFeatures = await utils.getManagedFeatures();
}

class DwUI {
  constructor(element) {
    this._element = element;
    this._page = undefined;
  }

  /**
   * @param {string, object} message
   * @param {number} [duration]
   * @param [icon]
   * @param {'primary' | 'success' | 'info' | 'warning' | 'danger'} [type]
   * @param {boolean} [closable]
   */
  showToast(message, {duration, icon, type} = {}) {
    if (typeof message === "object") {
      message = JSON.stringify(message, null, 4);
    }

    if (typeof message !== "string") {
      return;
    }

    if (typeof type !== "string") {
      type = constants.NOTIFICATION_TYPES.INFO;
    }

    if (typeof icon !== "string") {
      icon = undefined;
    }

    if (typeof duration !== "number") {
      duration = 5000;
    }

    utils.renderToast(message, type, duration);
  }

  disableMenu() {
    document.body.setAttribute("disable-menu", "");
  }

  enableMenu() {
    document.body.removeAttribute("disable-menu");
  }

  get page() {
    return this._page;
  }

  set page(page) {
    this._page = page;
  }
}

export {DwController, DwUI, setupDefaultModel};
