import { escapeHTML, isHTMLElement } from "../../components/utils.js";

const { WebcController } = WebCardinal.controllers;

let wasDwDialogDidGeneratorShown = false;

class DwController extends WebcController {
  constructor(...props) {
    super(...props);
    this._ui = new DwUI(...props);

    for (const item of ["did", "messageProcessingService"]) {
      this[item] = WebCardinal.wallet[item];
    }
    this.domain = WebCardinal.wallet.vaultDomain;

    if (!this.did) {
      if (WebCardinal.state.page.tag !== "my-identities") {
        this.navigateToPageTag("my-identities");
        return;
      }

      if (!wasDwDialogDidGeneratorShown) {
        this.ui.showDialogFromComponent("dw-dialog-did-generator", [], {
          disableClosing: true,
        });
        wasDwDialogDidGeneratorShown = true;
      }
    }

    this.storageService = this.getWalletStorage();
  }

  get ui() {
    return this._ui;
  }

  get domain() {
    return WebCardinal.wallet.blockchainDomain;
  }

  set domain(blockchainDomain) {
    WebCardinal.wallet.blockchainDomain = blockchainDomain;
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
  showToast(message, { duration, icon, type, closable } = {}) {
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
      duration = 3000;
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

  /**
   * @param {string} component
   * @param {object | Proxy} [attributes]
   * @param {object} [options]
   * @param {function} [options.onClose]
   * @param {HTMLElement} [options.parentElement]
   * @param {boolean} [options.disableClosing]
   */
  async showDialogFromComponent(component, attributes = {}, options = {}) {
    let { parentElement, onClose, disableClosing } = options;
    if (typeof onClose !== "function") {
      onClose = () => {};
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

    const closeElement = slElement.querySelector("header > sl-icon-button[close]");
    if (closeElement) {
      closeElement.addEventListener("click", async () => {
        await slElement.hide();
      });
    }

    WebCardinal.state.page.dialogs = {
      ...WebCardinal.state.page.dialogs,
      [component]: slElement,
    };

    slElement.addEventListener("sl-hide", async () => {
      dialogElement.remove();
      await onClose();
    });

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

    const promise = new Promise((resolve, reject) => {
      if (!slFormElement) {
        return reject("'sl-form' element not found!");
      }

      slFormElement.addEventListener("sl-submit", (event) => {
        const { formControls } = event.detail;
        const result = {};
        for (const element of formControls) {
          const { name } = element;
          if (!name) {
            continue;
          }
          result[name] = element.value;
          if (element.tagName === "SL-INPUT") {
            const inputElement = element.shadowRoot.querySelector("[part=input]");
            const baseElement = element.shadowRoot.querySelector("[part=clear-button]");
            if (inputElement) {
              inputElement.value = "";
            }
            if (baseElement) {
              baseElement.remove();
            }
          }
          return resolve({ ...result, event });
        }
      });

      const cloneElement = slFormElement.cloneNode(true);
      slFormElement.parentElement.replaceChild(cloneElement, slFormElement);
    });

    if (slFormElement) {
      await slFormElement.submit();
    }

    return promise;
  }

  get page() {
    return this._page;
  }

  set page(page) {
    this._page = page;
  }
}

export { DwController, DwUI };
