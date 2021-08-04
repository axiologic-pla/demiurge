import config from "./dw-did-generator.config.js";

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
      const domainElement = createElement("sl-input", {
        className: "input--domain",
        value: "blockchain_domain",
      });
      const ssiSelectElement = createElement("dw-select", {
        className: "select--did-ssi",
        placeholder: "SSI Type",
        types: types.SSI.TYPES
      });
      const result = [ssiSelectElement, domainElement];

      ssiSelectElement.addEventListener("dw-change", (event) => {
        const { type } = event.detail;

        const baseElement = ssiSelectElement.parentElement;

        const oldContentElement = baseElement.querySelector(":scope > .content");
        oldContentElement && oldContentElement.remove();

        let newContentElement;

        const ssiTypes = Object.keys(types.SSI.TYPES);

        if (ssiTypes.includes(type)) {
          removeClassesByPrefixFromElement(baseElement, "did-ssi");

          const lowerCaseType = type.toLowerCase();
          newContentElement = templates[`did:ssi:${lowerCaseType}`]();
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
    ["did:ssi:key"]: () => {
      const baseElement = createElement("div");
      const keyElement = createElement("sl-input", {
        className: "input--key",
        value: "f828ebc0f9b5ac31651a9246d3e12b0e",
        readonly: true,
      });
      const versionElement = createElement("sl-input", {
        className: "input--version",
        value: "v2",
        readonly: true,
      });
      baseElement.append(keyElement, versionElement);
      return baseElement;
    },
    ["did:ssi:sread"]: () => {
      const baseElement = createElement("div");
      const hashPrivateKeyElement = createElement("sl-input", {
        className: "input--private-key",
        value: "f828ebc0f9b5ac31651a9246d3e12b0e",
        readonly: true,
      });
      const hashPublicKeyElement = createElement("sl-input", {
        className: "input--public-key",
        value: "f828ebc0f9b5ac31651a9246d3e12b0e",
        readonly: true,
      });
      baseElement.append(hashPrivateKeyElement, hashPublicKeyElement);
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

  const renderContent = (baseElement, type) => {
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

      const didInputElement = createElement("sl-input", {
        className: "input--did",
        // disabled: true,
        readonly: true,
        value: "did",
      });
      const didSelectElement = createElement("dw-select", {
        className: "select--did",
        placeholder,
        types
      });

      didSelectElement.addEventListener("dw-change", (event) => {
        const { type } = event.detail;
        renderContent(baseElement, type);
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
