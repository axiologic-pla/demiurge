import config from "./dw-did-generator.config.js";
import constants from "../../scripts/constants.js";
import utils from "../../scripts/utils.js";

const { promisify } = utils;

// helpers

function createElement(tagName, properties = {}) {
  return Object.assign(document.createElement(tagName), properties);
}

function removeClassesByPrefixFromElement(element, prefix) {
  let classes = element.className;

  if (prefix) {
    classes = element.className.split(" ").filter((c) => !c.startsWith(prefix));
  }

  element.className = classes.join(" ").trim();
}

// main

function createSelect(types) {
  return class _ extends HTMLElement {
    constructor() {
      super();

      this._allTypes = types || {};

      this._setActiveType = (type) => {
        Object.keys(this.buttonElements)
          .filter((key) => key !== type)
          .forEach((key) => (this.buttonElements[key].type = "default"));

        this.buttonElements[type].type = "primary";
        this._activeType = type;
        this.setAttribute("type", type.toLowerCase());
        this.dispatchEvent(new CustomEvent("dw-change", { detail: { type } }));
      };

      this._unsetActiveType = () => {
        Object.keys(this.buttonElements).forEach((key) => (this.buttonElements[key].type = "default"));
        this._activeType = undefined;
        this.removeAttribute("type");
        this.dispatchEvent(new CustomEvent("dw-change", { detail: { type: undefined } }));
      };
    }

    connectedCallback() {
      this.buttonElements = {};
      this.nthElements = [];

      this._activeType = undefined;

      const groupElement = document.createElement("sl-select");
      groupElement.setAttribute("placeholder", this.placeholder);
      for (const type of this.types) {
        this.buttonElements[type] = Object.assign(document.createElement("sl-menu-item"), {
          size: "large",
          innerText: this._allTypes[type].LABEL,
          value: type,
        });
        this.buttonElements[type].dataset.tag = type.toLowerCase();
        groupElement.append(this.buttonElements[type]);
      }
      for (const type of this.types) {
        this.buttonElements[type].addEventListener("click", () => (this.type = type));
      }

      this.nthElements.push(groupElement);
      this.append(...this.nthElements);
    }

    disconnectedCallback() {
      this.innerHTML = "";
    }

    static get observedAttributes() {
      return ["type"];
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (this.hasAttribute(name)) {
        switch (name) {
          case "type":
            this.type = newValue;
        }
      }
    }

    set type(newType) {
      if (typeof newType === "undefined") {
        this._unsetActiveType();
        return;
      }

      if (typeof newType !== "string" || !this.types.includes(newType)) {
        return;
      }

      newType = newType.toUpperCase();

      if (this.type === newType) {
        return;
      }

      this._setActiveType(newType);
    }

    get type() {
      return this._activeType;
    }

    set types(types) {
      this._allTypes = types;
    }

    get types() {
      return Object.keys(this._allTypes);
    }
  };
}

function createDidGenerator(config) {
  const types = config.TYPES;
  const placeholder = config.PLACEHOLDER;

  const templates = {
    ["did:ssi"]: () => {
      const domainElement = createElement("sl-tag", {
        className: "input--domain",
        innerHTML: "blockchain_domain",
        size: "large",
        hidden: true,
      });
      const ssiSelectElement = createElement("dw-select", {
        className: "select--did-ssi",
        placeholder: "SSI Type",
        types: types.SSI.TYPES,
      });
      const result = [ssiSelectElement, domainElement];

      ssiSelectElement.addEventListener("dw-change", async (event) => {
        const { type } = event.detail;

        const baseElement = ssiSelectElement.parentElement;

        const oldContentElement = baseElement.querySelector(":scope > .content");
        oldContentElement && oldContentElement.remove();

        let newContentElement;

        const ssiTypes = Object.keys(types.SSI.TYPES);

        if (ssiTypes.includes(type)) {
          removeClassesByPrefixFromElement(baseElement, "did-ssi");

          const { payload } = await completeComponentWithDIDMethods("SSI", type);

          domainElement.hidden = false;

          const lowerCaseType = type.toLowerCase();
          newContentElement = await templates[`did:ssi:${lowerCaseType}`](payload);
          baseElement.classList.add(`did-ssi-${lowerCaseType}`);
        }

        if (newContentElement) {
          newContentElement.classList.add("content");
          baseElement.append(newContentElement);
        }
      });
      return result;
    },
    ["did:ssi:name"]: () => {
      return createElement("sl-input", {
        className: "input--name",
        placeholder: "Type name...",
      });
    },
    ["did:ssi:group"]: () => {
      return createElement("sl-input", {
        className: "input--group",
        placeholder: "Type group...",
      });
    },
    ["did:ssi:key"]: async ({ publicKey }) => {
      return createElement("sl-input", {
        className: "input--key",
        value: publicKey,
        readonly: true,
      });
    },
    ["did:ssi:sread"]: ({ hashPrivateKey, hashPublicKey, version }) => {
      const baseElement = createElement("div");
      const hashPrivateKeyElement = createElement("sl-input", {
        className: "input--private-key",
        value: hashPrivateKey,
        readonly: true,
      });
      const hashPublicKeyElement = createElement("sl-input", {
        className: "input--public-key",
        value: hashPublicKey,
        readonly: true,
      });
      const versionElement = createElement("sl-input", {
        className: "input--version",
        value: version,
        readonly: true,
      });
      baseElement.append(hashPrivateKeyElement, hashPublicKeyElement, versionElement);
      return baseElement;
    },
    ["did:web"]: () => {
      const inputElement = createElement("sl-input", {
        className: "input--web",
        value: "internet_domain",
      });
      return [inputElement];
    },
    ["did:key"]: () => {
      const keyElement = createElement("sl-input", {
        className: "input--key",
        value: "0a528bfadc74417869ea4f1b400b0432",
        readonly: true,
      });
      return [keyElement];
    },
  };

  const completeComponentWithDIDMethods = async (type, subType) => {
    const openDSU = require("opendsu");
    const keySSI = openDSU.loadApi("keyssi");
    const w3cDID = openDSU.loadAPI("w3cdid");

    // TODO: configurable blockchain domains
    const domain = constants.DOMAIN;

    const didMethod = type.toLowerCase();
    const didSubMethod = subType && subType.toLowerCase();

    let didDocument;
    const payload = {};

    if (didMethod === "ssi") {
      switch (didSubMethod) {
        case "sread": {
          const seedSSI = await promisify(keySSI.createSeedSSI)(domain);
          didDocument = await promisify(w3cDID.createIdentity)("sread", seedSSI);

          payload.identifier = didDocument.getIdentifier();
          payload.hash = didDocument.getHash();

          const [hashPrivateKey, hashPublicKey, version] = payload.identifier.split(":").slice(4);
          payload.hashPrivateKey = hashPrivateKey;
          payload.hashPublicKey = hashPublicKey;
          payload.version = version;

          break;
        }

        case "key": {
          const seedSSI = await promisify(keySSI.createSeedSSI)(domain);
          didDocument = await promisify(w3cDID.createIdentity)("key", seedSSI);

          payload.identifier = didDocument.getIdentifier();
          // payload.publicKey = await promisify(didDocument.getPublicKey)("pem");
          payload.publicKey = payload.identifier.split(":").pop();

          break;
        }
      }
    }

    console.log(didDocument);
    console.log(payload);

    return { didDocument, payload };
  };

  const renderContent = async (baseElement, type) => {
    let contentElement = baseElement.querySelector(":scope > .content");
    let content;

    if (Object.keys(types).includes(type)) {
      content = templates[`did:${type.toLowerCase()}`]();
    }

    if (!content) {
      contentElement && contentElement.remove();
      return;
    }

    if (!contentElement) {
      contentElement = createElement("div", {
        className: "content",
        part: "content",
      });
    }

    await completeComponentWithDIDMethods(type, null);

    removeClassesByPrefixFromElement(contentElement, "did");
    contentElement.innerHTML = "";
    contentElement.append(...content);

    removeClassesByPrefixFromElement(baseElement, "did");
    baseElement.classList.add(`did-${type.toLowerCase()}`);
    baseElement.append(contentElement);
  };

  return class _ extends HTMLElement {
    constructor() {
      super();

      this.attachShadow({ mode: "open" });
    }

    connectedCallback() {
      const component = this.tagName.toLowerCase();

      const linkElement = createElement("link", {
        rel: "stylesheet",
        href: `./components/${component}/${component}.css`,
      });
      const baseElement = createElement("div", {
        className: "base",
        part: "base",
      });

      const didInputElement = createElement("sl-tag", {
        className: "input--did",
        innerHTML: "did",
        size: "large",
      });
      const didSelectElement = createElement("dw-select", {
        className: "select--did",
        placeholder,
        types,
      });

      didSelectElement.addEventListener("dw-change", async (event) => {
        const { type } = event.detail;
        await renderContent(baseElement, type);
      });

      baseElement.append(didInputElement, didSelectElement);
      this.shadowRoot.append(linkElement, baseElement);
    }

    disconnectedCallback() {
      this.shadowRoot.innerHTML = "";
    }
  };
}

customElements.define("dw-select", createSelect());
customElements.define("dw-did-generator", createDidGenerator(config));
