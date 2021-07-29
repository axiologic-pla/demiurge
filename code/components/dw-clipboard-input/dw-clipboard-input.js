import { DwUI } from '../../scripts/controllers/DwController.js';

class DwClipboardInput extends HTMLElement {
  constructor() {
    super();

    this.showToast = new DwUI().showToast;

    this.iconElement = Object.assign(document.createElement('sl-icon'), {
      name: 'clipboard',
      slot: 'suffix',
    });

    this.inputElement = document.createElement('sl-input');
    for (let i = 0; i < this.attributes.length; i++) {
      const { name, value } = this.attributes[i];
      if (name === 'value') {
        continue;
      }
      this.inputElement.setAttribute(name, value);
    }
    this.inputElement.append(this.iconElement);

    this.append(this.inputElement);

    this.onClipboardClick = async (event) => {
      event.stopPropagation();
      const { value } = this.inputElement;
      this.inputElement.select();
      this.inputElement.setSelectionRange(0, value.length);
      document.execCommand('copy');
      this.inputElement.setSelectionRange(0, 0);
      this.inputElement.blur();
      await this.showToast(`"${value}" copied to clipboard!`, {
        duration: 1500,
      });
    };
  }

  connectedCallback() {
    const suffixElement = this.inputElement.shadowRoot.querySelector('[part=suffix]');
    if (suffixElement) {
      suffixElement.addEventListener('click', this.onClipboardClick);
    }
  }

  disconnectedCallback() {
    const suffixElement = this.inputElement.shadowRoot.querySelector('[part=suffix]');
    if (suffixElement) {
      suffixElement.removeEventListener('click', this.onClipboardClick);
    }
  }

  set value(value) {
    this.inputElement.value = value;
  }

  get value() {
    return this.inputElement.value;
  }

  get slInput() {
    return this.inputElement;
  }
}

customElements.define('dw-clipboard-input', DwClipboardInput);
