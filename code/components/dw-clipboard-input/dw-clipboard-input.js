import { DwUI } from "../../scripts/controllers/DwController.js";

class DwClipboardInput extends HTMLElement {
  constructor() {
    super();

    this.showToast = new DwUI().showToast;
    this._value = "";
  }

  async connectedCallback() {
    const iconElement = Object.assign(document.createElement("sl-icon"), {
      name: "clipboard",
      slot: "suffix",
    });

    this.inputElement = document.createElement("sl-input");
    for (let i = 0; i < this.attributes.length; i++) {
      const { name, value } = this.attributes[i];
      if (name === "value") {
        continue;
      }
      this.inputElement.setAttribute(name, value);
    }
    this.inputElement.value = this._value;
    this.inputElement.append(iconElement);

    this.append(this.inputElement);

    this.onClipboardClick = async (event) => {
      const { inputElement, showToast } = this;
      const { value } = inputElement;
      event.stopPropagation();
      inputElement.select();
      inputElement.setSelectionRange(0, value.length);
      document.execCommand("copy");
      inputElement.setSelectionRange(0, 0);
      inputElement.blur();
      await showToast(`"${value}" copied to clipboard!`, {
        duration: 1500,
      });
    };

    this.inputElement.updateComplete.then(() => {
      const suffixElement = this.inputElement.shadowRoot.querySelector("[part=suffix]");
      suffixElement.addEventListener("click", this.onClipboardClick);
    });
  }

  disconnectedCallback() {
    const suffixElement = this.inputElement.shadowRoot.querySelector("[part=suffix]");
    if (suffixElement) {
      suffixElement.removeEventListener("click", this.onClipboardClick);
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
  }

  get value() {
    return this.inputElement.value;
  }
}

customElements.define("dw-clipboard-input", DwClipboardInput);
