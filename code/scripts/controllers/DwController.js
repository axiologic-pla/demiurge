import {escapeHTML, isHTMLElement} from "../../components/utils.js";

const {WebcController} = WebCardinal.controllers;

class DwController extends WebcController {
  constructor(...props) {
    super(...props);
    this._ui = new DwUI(...props);
    if (!$$.history) {
      $$.history = props[1];
    }
    for (const item of ["did", "userDetails", "userName", "status", "managedFeatures", "messageProcessingService"]) {
      this[item] = WebCardinal.wallet[item];
    }
    this.domain = WebCardinal.wallet.vaultDomain;
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

class DwUI {
  constructor(element) {
    this._element = element;
    this._page = undefined;
  }

  async submitGenericForm(model, target) {
    let element = target;
    let slFormElement;

    while (element) {
      element = element.parentElement;

      if (element.tagName === "SL-FORM") {
        slFormElement = element;
        break;
      }
    }

    return new Promise(async (resolve, reject) => {
      if (!slFormElement) {
        return reject("'sl-form' element not found!");
      }

      function listener(event) {
        const result = {};
        const {formControls} = event.detail;

        for (const element of formControls) {
          const {name} = element;
          if (!name) {
            continue;
          }
          result[name] = element.value;
          if (element.tagName === "SL-INPUT") {
            const inputElement = element.shadowRoot.querySelector(
              "[part=input]"
            );
            const baseElement = element.shadowRoot.querySelector(
              "[part=clear-button]"
            );
            if (inputElement) {
              element.value = "";
              inputElement.value = "";
            }
            if (baseElement) {
              baseElement.remove();
            }
          }
          return resolve({...result, event});
        }
      }

      slFormElement.addEventListener("sl-submit", listener);
      await slFormElement.submit();
      slFormElement.removeEventListener("sl-submit", listener);
    });
  }

  /**
   * @param {string, object} message
   * @param {number} [duration]
   * @param [icon]
   * @param {'primary' | 'success' | 'info' | 'warning' | 'danger'} [type]
   * @param {boolean} [closable]
   */
  showToast(message, {duration, icon, type, closable} = {}) {
    if (typeof message === "object") {
      message = JSON.stringify(message, null, 4);
    }

    if (typeof message !== "string") {
      return;
    }

    if (typeof type !== "string") {
      type = "primary";
    }

    if (typeof icon !== "string") {
      icon = undefined;
    }

    if (typeof duration !== "number") {
      duration = 30000;
    }

    if (typeof closable !== "boolean") {
      closable = true;
    }

    const alert = Object.assign(document.createElement("sl-alert"), {
      type: type,
      closable: closable,
      duration: duration,
      innerHTML: `
            ${icon ? `<sl-icon name="${icon}" slot="icon"></sl-icon>` : ""}
            ${escapeHTML(message)}
        `,
    });

    document.body.append(alert);

    return alert.toast();
  }

  disableMenu() {
    document.body.setAttribute("disable-menu", "");
  }

  enableMenu() {
    document.body.removeAttribute("disable-menu");
  }

  /**
   * @param {string} component
   * @param {object | Proxy} [attributes]
   * @param {object} [options]
   * @param {function} [options.onClose]
   * @param {HTMLElement} [options.parentElement]
   * @param {boolean} [options.disableClosing]
   */
  async showDialogFromComponent(component, attributes = {}, options = {}) {
    let {parentElement, onClose, disableClosing} = options;
    if (typeof onClose !== "function") {
      onClose = () => {
      };
    }

    if (!isHTMLElement(parentElement)) {
      parentElement = undefined;
    }

    const dialogElement = document.createElement(component);
    for (const attribute of Object.keys(attributes)) {
      dialogElement.setAttribute(attribute, escapeHTML(attributes[attribute]));
    }

    if (parentElement) {
      parentElement.append(dialogElement);
    } else {
      WebCardinal.state.page.loader.append(dialogElement);
    }

    await dialogElement.componentOnReady();

    const slElement = dialogElement.querySelector("sl-dialog");

    if (!slElement) {
      return;
    }

    if (disableClosing) {
      slElement.addEventListener("sl-request-close", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
      });
      slElement.addEventListener("sl-hide", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
      });
    }

    // const closeElements = slElement.querySelectorAll("[close]");
    // closeElements.forEach((closeElement) => {
    //   closeElement.addEventListener("click", async () => {
    //     await slElement.hide();
    //   });
    // });

    WebCardinal.state.page.dialogs = {
      ...WebCardinal.state.page.dialogs,
      [component]: slElement,
    };

    slElement.addEventListener("sl-request-close", async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    });

    slElement.addEventListener("sl-hide", async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      await onClose();
    });

    if (slElement.querySelector("sl-icon-button[close]")) {
      slElement.querySelector("sl-icon-button[close]").addEventListener("click", async () => {
        dialogElement.remove();
        await onClose();
      })
    }


    setTimeout(async () => {
      await slElement.show();
    });
  }

  /**
   * @param {string} component
   */
  async hideDialogFromComponent(component) {
    await WebCardinal.state.page.dialogs[component].hide();
  }

  get page() {
    return this._page;
  }

  set page(page) {
    this._page = page;
  }
}

export {DwController, DwUI};
