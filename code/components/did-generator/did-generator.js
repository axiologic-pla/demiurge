import config from "./did-generator.config.js";

const { promisify } = $$;

// DOM helpers

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

// OpenDSU SDK

/**
 * @param {string} domain - blockchain domain
 * @param {'SSI'|'KEY'|'WEB'} type - specifies did method
 * @param {'SREAD'|'KEY'|'GROUP'|'NAME'|undefined} [subType] - only for 'SSI' type
 */
async function generateDidDocumentBeforeSubmission(domain, type, subType) {
  const openDSU = require("opendsu");
  const keySSI = openDSU.loadApi("keyssi");
  const w3cDID = openDSU.loadAPI("w3cdid");

  const didMethod = type.toLowerCase();
  const didSubMethod = subType && subType.toLowerCase();

  let didDocument;
  let canBeSubmitted = false;
  const payload = {};

  switch (didMethod) {
    case "ssi": {
      switch (didSubMethod) {
        case "sread": {
          const seedSSI = await promisify(keySSI.createSeedSSI)(domain);
          payload.domain = domain;

          didDocument = await promisify(w3cDID.createIdentity)("sread", seedSSI);

          const [hashPrivateKey, hashPublicKey, version] = didDocument.getIdentifier().split(":").slice(4);
          payload.hashPrivateKey = hashPrivateKey;
          payload.hashPublicKey = hashPublicKey;
          payload.version = version;

          canBeSubmitted = true;

          break;
        }
        case "key": {
          const seedSSI = await promisify(keySSI.createSeedSSI)(domain);
          payload.domain = domain;

          didDocument = await promisify(w3cDID.createIdentity)("ssikey", seedSSI);

          payload.publicKey = didDocument.getIdentifier().split(":").pop();

          canBeSubmitted = true;

          break;
        }
        case "group":
        case "name": {
          payload.domain = domain;
          canBeSubmitted = true;
          break;
        }
      }
      break;
    }

    case "key": {
      canBeSubmitted = true;
      didDocument = await promisify(w3cDID.createIdentity)("key");
      const splitDID = didDocument.getIdentifier().split(":");
      payload.publicKey = splitDID.pop();
      break;
    }

    case "web": {
      canBeSubmitted = true;
      break;
    }
  }

  return { didDocument, canBeSubmitted, payload };
}

/**
 * @see generateDidDocumentBeforeSubmission.
 */
async function generateDidDocumentAfterSubmission(domain, type, subType, payload) {
  const openDSU = require("opendsu");
  const w3cDID = openDSU.loadAPI("w3cdid");

  const didMethod = type.toLowerCase();
  const didSubMethod = subType && subType.toLowerCase();

  let didDocument;

  switch (didMethod) {
    case "ssi": {
      switch (didSubMethod) {
        case "group":
        case "name": {
          didDocument = await promisify(w3cDID.createIdentity)(didSubMethod, domain, payload);
          break;
        }
      }
      break;
    }
  }

  return { didDocument };
}

// DOM Components

function createDidGeneratorSelect(types) {
  return class _ extends HTMLElement {
    constructor() {
      super();

      this._allTypes = types || {};
      this._menuElement = undefined;

      this._setActiveType = (type) => {
        this._activeType = type;
        this.setAttribute("type", type.toLowerCase());
        this.dispatchEvent(new CustomEvent("dw-change", { detail: { type } }));

        if (this.isConnected) {
          this._menuElement.value = type;
        }
      };

      this._unsetActiveType = () => {
        this._activeType = undefined;
        this.removeAttribute("type");
        this.dispatchEvent(new CustomEvent("dw-change", { detail: { type: undefined } }));

        if (this.isConnected) {
          this._menuElement.value = "";
        }
      };
    }

    connectedCallback() {
      this._menuElement = createElement("sl-select", {
        placeholder: this.placeholder,
        value: this.type ? this.type : "",
      });
      const menuElements = {};
      for (const type of this.types) {
        menuElements[type] = createElement("sl-menu-item", {
          size: "large",
          innerText: this._allTypes[type].LABEL,
          value: type,
        });
        menuElements[type].dataset.tag = type.toLowerCase();
        menuElements[type].addEventListener("click", () => {
          this.type = type;
        });
        this._menuElement.append(menuElements[type]);
      }
      this.append(this._menuElement);
    }

    disconnectedCallback() {
      this._activeType = undefined;
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

      if (typeof newType !== "string") {
        return;
      }

      newType = newType.toUpperCase();

      if (!this.types.includes(newType)) {
        return;
      }

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
      return Object.keys(this._allTypes).map((type) => type);
    }
  };
}

function createDidGenerator(config) {
  let hostElement, rootElement, submitElement;

  const templates = {
    ["did:ssi"]: (payload) => {
      submitElement.hidden = true;

      const domainElement = createElement("sl-input", {
        className: "input--domain",
        value: payload.domain,
        placeholder: "domain",
        hidden: true,
      });
      const ssiSelectElement = createElement("did-generator-select", {
        className: "select--did-ssi",
        placeholder: config.TYPES.SSI.PLACEHOLDER,
        types: filterDisabledDIDs(config.TYPES.SSI.TYPES, "did:ssi:"),
      });
      const result = [ssiSelectElement, domainElement];

      let ssiType = undefined;
      let domain = payload.domain;

      const update = async () => {
        let baseElement = ssiSelectElement.parentElement;

        const oldContentElement = baseElement.querySelector(":scope > .content");
        oldContentElement && oldContentElement.remove();

        let newContentElement;

        const ssiTypes = Object.keys(config.TYPES.SSI.TYPES);

        if (ssiTypes.includes(ssiType)) {
          removeClassesByPrefixFromElement(baseElement, "did-ssi");

          const result = await generateDidDocumentBeforeSubmission(domain, "SSI", ssiType);

          domainElement.hidden = false;

          const lowerCaseType = ssiType.toLowerCase();
          newContentElement = await templates[`did:ssi:${lowerCaseType}`](result.payload);
          baseElement.classList.add(`did-ssi-${lowerCaseType}`);

          if (result.canBeSubmitted) {
            submitElement.hidden = false;
            const { didDocument, payload } = result;
            const data = didDocument ? { didDocument } : { ...payload };
            await preSubmit(payload.domain, "SSI", ssiType, data);
          }
        }

        if (newContentElement) {
          newContentElement.classList.add("content");
          baseElement.append(newContentElement);
        }
      };

      domainElement.addEventListener("sl-change", async () => {
        domain = domainElement.value;
        await update();
      });

      ssiSelectElement.addEventListener("dw-change", async (event) => {
        ssiType = event.detail.type;
        await update();
      });

      return result;
    },
    ["did:ssi:name"]: (payload) => {
      payload.inputElement = createElement("sl-input", {
        className: "input--name",
        placeholder: "Type name...",
        readonly: isReadOnlyDID("did:ssi:name"),
      });
      if (hostElement.hasAttribute("name")) {
        payload.inputElement.value = hostElement.getAttribute("name");
      }
      return payload.inputElement;
    },
    ["did:ssi:group"]: (payload) => {
      payload.inputElement = createElement("sl-input", {
        className: "input--group",
        placeholder: "Type group...",
      });
      return payload.inputElement;
    },
    ["did:ssi:key"]: (payload) => {
      const { publicKey } = payload;
      return createElement("sl-input", {
        className: "input--key",
        value: publicKey,
        readonly: true,
      });
    },
    ["did:ssi:sread"]: (payload) => {
      const { hashPrivateKey, hashPublicKey, version } = payload;

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
      submitElement.hidden = true;
      return [
        createElement("sl-input", {
          className: "input--web",
          value: "internet_domain",
        }),
      ];
    },
    ["did:key"]: (payload) => {
      const {publicKey} = payload;
      // submitElement.hidden = true;
      return [
        createElement("sl-input", {
          className: "input--key",
          value: publicKey,
          readonly: true,
        }),
      ];
    },
  };

  const isReadOnlyDID = (item) => {
    if (hostElement.hasAttribute("readonly")) {
      const readOnlyAttribute = hostElement.getAttribute("readonly") || "";
      const readOnlyDIDs = readOnlyAttribute.split(/[ ,]/).filter(String);
      return readOnlyDIDs.includes(item);
    }
    return false;
  };

  const filterDisabledDIDs = (originalTypes, prefix = "") => {
    const types = Object.assign({}, originalTypes);

    if (hostElement.hasAttribute("disable")) {
      const disabledAttribute = hostElement.getAttribute("disable") || "";
      const disabledDIDs = disabledAttribute.split(/[ ,]/);
      disabledDIDs.filter(String).map((item) => {
        if (item.startsWith(prefix)) {
          item = item.substr(prefix.length, item.length).toUpperCase();
        }
        delete types[item];
      });
      return types;
    }
    return types;
  };

  const renderContent = async (domain, type) => {
    let contentElement = rootElement.querySelector(":scope > .content");
    let generatedTemplate;

    if (Object.keys(config.TYPES).includes(type)) {
      generatedTemplate = templates[`did:${type.toLowerCase()}`]({ domain });
    }

    if (!generatedTemplate) {
      contentElement && contentElement.remove();
      return;
    }

    if (!contentElement) {
      contentElement = createElement("div", {
        className: "content",
        part: "content",
      });
    }

    const result = await generateDidDocumentBeforeSubmission(domain, type, undefined);
    if (result.canBeSubmitted) {
      // delete result.canBeSubmitted;
      // await preSubmit(domain, type, null, result);
    }

    removeClassesByPrefixFromElement(contentElement, "did");
    contentElement.innerHTML = "";
    contentElement.append(...generatedTemplate);

    removeClassesByPrefixFromElement(rootElement, "did");
    rootElement.classList.add(`did-${type.toLowerCase()}`);
    rootElement.append(contentElement);
  };

  const preSubmit = async (domain, type, subType, data) => {
    submitElement.hidden = false;
    submitElement.data = { domain, type, subType, ...data };
  };

  return class _ extends HTMLElement {
    constructor() {
      super();

      this.attachShadow({ mode: "open" });
      hostElement = this;
    }

    connectedCallback() {
      const component = this.tagName.toLowerCase();

      const linkElement = createElement("link", {
        rel: "stylesheet",
        href: `./components/${component}/${component}.css`,
      });
      rootElement = createElement("div", {
        className: "main",
        part: "main",
      });
      submitElement = createElement("sl-button", {
        className: "submit--did",
        part: "submit",
        type: "primary",
        hidden: true,
        innerHTML: `
          <sl-icon slot="prefix" name="shield-fill-plus"></sl-icon>
          Save identity
        `,
      });
      const footerElement = createElement("div", {
        className: "footer",
        part: "footer",
      });
      const didTagElement = createElement("sl-tag", {
        className: "input--did",
        innerHTML: "did",
        size: "large",
      });
      const didSelectElement = createElement("did-generator-select", {
        className: "select--did",
        placeholder: config.PLACEHOLDER,
        types: filterDisabledDIDs(config.TYPES, "did:"),
      });

      footerElement.append(submitElement);
      rootElement.append(didTagElement, didSelectElement);

      didSelectElement.addEventListener("dw-change", async (event) => {
        const { type } = event.detail;
        await renderContent(this.domain, type);
        if (this.hasAttribute("default")) {
          const attribute = this.getAttribute("default") || "";
          const keywords = attribute.split(":");
          const didSsiSelectElement = rootElement.querySelector(".select--did-ssi");
          didSsiSelectElement.type = keywords[2];
        }
      });

      submitElement.addEventListener("click", async () => {
        let { didDocument } = submitElement.data;

        if (!didDocument) {
          const { domain, type, subType, inputElement } = submitElement.data;
          const { didDocument: result } = await generateDidDocumentAfterSubmission(
            domain,
            type,
            subType,
            inputElement.value
          );
          didDocument = result;
        }

        if (didDocument) {
          const model = this.getDataTagModel();
          this.getDataTagModel = () => ({
            ...model,
            didDocument,
          });

          this.dispatchEvent(
            new CustomEvent("did-generate", {
              detail: { didDocument },
              bubbles: true,
              cancelable: true,
            })
          );
        }
      });

      if (this.hasAttribute("default")) {
        const attribute = this.getAttribute("default") || "";
        const keywords = attribute.split(":");
        didSelectElement.type = keywords[1];
      }

      this.shadowRoot.append(linkElement, rootElement, footerElement);
    }

    disconnectedCallback() {
      this.shadowRoot.innerHTML = "";
    }

    get domain() {
      return this.getAttribute("domain");
    }

    set domain(domain) {
      this.setAttribute("domain", domain);
    }
  };
}

customElements.define("did-generator-select", createDidGeneratorSelect());
customElements.define("did-generator", createDidGenerator(config));
