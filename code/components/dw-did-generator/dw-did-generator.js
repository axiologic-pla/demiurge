import config from "./dw-did-generator.config.js";

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

          didDocument = await promisify(w3cDID.createIdentity)("key", seedSSI);

          payload.publicKey = didDocument.getIdentifier().split(":").pop();

          canBeSubmitted = true;

          break;
        }
        case "group":
        case "name": {
          canBeSubmitted = true;
          break;
        }
      }
      break;
    }

    case "key": {
      canBeSubmitted = true;
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
  let rootElement, submitElement;

  const types = config.TYPES;
  const placeholder = config.PLACEHOLDER;

  const templates = {
    ["did:ssi"]: (payload) => {
      const { domain } = payload;

      submitElement.hidden = true;

      const domainElement = createElement("sl-input", {
        className: "input--domain",
        value: domain,
        hidden: true,
      });
      const ssiSelectElement = createElement("dw-did-generator-select", {
        className: "select--did-ssi",
        placeholder: types.SSI.PLACEHOLDER,
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

          const result = await generateDidDocumentBeforeSubmission(domain, "SSI", type);

          domainElement.hidden = false;

          const lowerCaseType = type.toLowerCase();
          newContentElement = await templates[`did:ssi:${lowerCaseType}`](result.payload);
          baseElement.classList.add(`did-ssi-${lowerCaseType}`);

          if (result.canBeSubmitted) {
            submitElement.hidden = false;
            const { didDocument, payload } = result;
            const data = didDocument ? { didDocument } : { ...payload };
            await preSubmit(domain, "SSI", type, data);
          }
        }

        if (newContentElement) {
          newContentElement.classList.add("content");
          baseElement.append(newContentElement);
        }
      });
      return result;
    },
    ["did:ssi:name"]: (payload) => {
      payload.inputElement = createElement("sl-input", {
        className: "input--name",
        placeholder: "Type name...",
      });
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
    ["did:key"]: () => {
      submitElement.hidden = true;
      return [
        createElement("sl-input", {
          className: "input--key",
          value: "0a528bfadc74417869ea4f1b400b0432",
          readonly: true,
        }),
      ];
    },
  };

  const renderContent = async (domain, type) => {
    let contentElement = rootElement.querySelector(":scope > .content");
    let content;

    if (Object.keys(types).includes(type)) {
      content = templates[`did:${type.toLowerCase()}`]({ domain });
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

    const result = await generateDidDocumentBeforeSubmission(domain, type, undefined);
    if (result.canBeSubmitted) {
      // delete result.canBeSubmitted;
      // await preSubmit(domain, type, null, result);
    }

    removeClassesByPrefixFromElement(contentElement, "did");
    contentElement.innerHTML = "";
    contentElement.append(...content);

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
      // this.setAttribute('shadow', '');
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
      const didSelectElement = createElement("dw-did-generator-select", {
        className: "select--did",
        placeholder,
        types,
      });

      footerElement.append(submitElement);
      rootElement.append(didTagElement, didSelectElement);

      didSelectElement.addEventListener("dw-change", async (event) => {
        const { type } = event.detail;
        await renderContent(this.domain, type);
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

customElements.define("dw-did-generator-select", createDidGeneratorSelect());
customElements.define("dw-did-generator", createDidGenerator(config));
