import {DwUI} from "../../scripts/controllers/DwController.js";

const template = document.createElement('template');

template.innerHTML = `
<style>
.copy-paste-input-container {
    border-radius: 8px;
    border: 1px solid #328569;
    background: #FFF;
    font-size: 1rem;
    height: 2.5rem;
    flex: 1 1 auto;
    display: inline-flex;
    align-items: stretch;
    justify-content: start;
    position: relative;
    width: 100%;
    vertical-align: middle;
    overflow: hidden;
    transition: 150ms color, 150ms border, 150ms box-shadow;
    cursor: text;
}
.copy-paste-input-container input {
    height: calc(2.5rem - 1px * 2);
    margin: 0 1rem;
    flex: 1 1 auto;
    font-family: "DM Sans medium";
    font-size: inherit;
    font-weight: inherit;
    min-width: 0px;
    color: #328569;
    border: none;
    background: none;
    box-shadow: none;
    padding: 0px;
    cursor: inherit;
    appearance: none;
    font-family: "DM Sans regular";
}

.copy-paste-input-container input:focus {
    outline: none;
}

.copy-paste-input-container button {
    background: none;
    border: none;
    color: #328569;
    font-style: normal;
    font-weight: 700;
    margin-right: 10px;
    cursor: pointer;
    font-size: 1.1rem;
    font-family: "DM Sans regular";
}
.copy-paste-input-container button:hover {
    color: #039665;
}

 </style>
 <div class="form-group copy-paste-input-container" part="input-container">
    <input class="form-control" part="input-element">
    <button class="input-action" part="button-element"></button>
 </div>
    `;

class DwCopyPasteInput extends HTMLElement {
  constructor() {
    super();
    this._value = "";
    this._inputType = "text";
    this._type = "copy";
    this.attachShadow({mode: 'open'});
    this.showToast = new DwUI().showToast;
    this.shadowRoot.appendChild(template.content.cloneNode(true));
    this.inputElement = this.shadowRoot.querySelector("input");
    this.buttonElement = this.shadowRoot.querySelector("button");
    this.buttonElement.addEventListener("click", this.btnClickHandler.bind(this))
    this.inputElement.addEventListener("input", this.inputChange.bind(this))
  }

  async connectedCallback() {
    for (let i = 0; i < this.attributes.length; i++) {
      const {name, value} = this.attributes[i];
      if (name === "value") {
        continue;
      }

      if (name === "inputType") {
        this.inputElement.setAttribute("type", value);
        continue;
      }

      if (name === "button-type") {
        this.type = value;
        continue;
      }

      if (name === "button-label") {
        this.buttonElement.innerText = value;
        continue;
      }
      this.inputElement.setAttribute(name, value);
    }
  }

  inputChange(event) {
    this.value = event.target.value;
  }

  async btnClickHandler(event) {
    if (this.type.toLowerCase() === "paste") {
      const result = await navigator.permissions.query({
        name: "clipboard-read",
      });
      if (result.state === "granted" || result.state === "prompt") {
        this.value = await navigator.clipboard.readText();
      }
    }
    if (this.type.toLowerCase() === "copy") {
      try {
        document.execCommand("copy");
      } catch (err) {
        // we ignore the error due to the fact that some browsers don't support one of the methods in the try block
      }
      try {
        await navigator.clipboard.writeText(this.inputElement.value)
      } catch (err) {
        // we ignore the error due to the fact that some browsers don't support one of the methods in the try block
      }
      await this.showToast(`Copied to clipboard!`);
      this.dispatchEvent(new CustomEvent("copy-to-clipboard", {
        bubbles: true,
        detail: {"value": this.inputElement.value}
      }));
    }
  }


  disconnectedCallback() {
    if (this.buttonElement) {
      this.buttonElement.removeEventListener("click", this.btnClickHandler);
    }
    this.innerHTML = "";
  }

  static get observedAttributes() {
    return ["value"];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (this.hasAttribute(name)) {
      switch (name) {
        case "value":
          this.value = newValue;
      }
    }
  }

  set value(value) {
    if (this.inputElement) {
      this.inputElement.value = value;
    }
    this._value = value;
    this.dispatchEvent(new CustomEvent("copy-paste-change", {
      bubbles: true,
      detail: {"value": value}
    }));
  }

  get value() {
    return this._value;
  }

  set inputType(value) {
    if (this.inputElement) {
      this.inputElement.type = value;
    }
  }

  get inputType() {
    return this.inputElement.type;
  }

  set type(value) {
    this._type = value;
  }

  get type() {
    return this._type;
  }
}

customElements.define("dw-copy-paste-input", DwCopyPasteInput);


/*
customElements.define(
  "dw-copy-paste-input",
  class _ extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });

      const linkElement = document.createElement("link");
      linkElement.setAttribute("rel", "stylesheet");
      linkElement.setAttribute("href", "components/dw-title/dw-title.css");

      const headerElement = document.createElement("h2");
      headerElement.classList.add("header");
      headerElement.setAttribute("part", "header");
      headerElement.append(createSlotElement());

      const wrapperElement = document.createElement("div");
      wrapperElement.classList.add("base");
      wrapperElement.setAttribute("part", "base");
      wrapperElement.append(linkElement, headerElement, createSlotElement("subheader"));

      if (this.hasAttribute("header")) {
        this.append(escapeHTML(this.getAttribute("header")));
      }

      if (this.hasAttribute("subheader")) {
        const subheaderElement = document.createElement("p");
        subheaderElement.setAttribute("slot", "subheader");
        subheaderElement.innerText = escapeHTML(this.getAttribute("subheader"));
        this.append(subheaderElement);
      }

      this.shadowRoot.append(wrapperElement);
    }
  }
);
*/
