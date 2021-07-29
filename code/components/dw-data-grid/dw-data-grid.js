function createSlotElement(name) {
  const namedSlot = document.createElement('slot');
  namedSlot.setAttribute('name', name);
  return namedSlot;
}

customElements.define(
  'dw-data-grid',
  class _ extends HTMLElement {
    constructor() {
      super();
      let element = this;
      while (element && element instanceof HTMLElement) {
        if (element.tagName === 'WEBC-CONTAINER') {
          this.containerElement = element;
        }

        element = element.parentElement;
      }

      this.attachShadow({ mode: 'open' });
    }

    async connectedCallback() {
      const templateElement = this.querySelector('[slot="template"]');
      const templateChildren = templateElement.children;
      templateElement.remove();

      const content = document.createElement('div');
      content.dataset.for = this.getAttribute('items');
      content.append(...templateChildren);
      this.append(content);

      const headerSlot = createSlotElement('header');
      const emptySlot = document.createElement('slot');
      const footerSlot = createSlotElement('footer');

      this.shadowRoot.append(headerSlot, emptySlot, footerSlot);

      // const model = await this.containerElement.getModel();
      // model.onChange(this.getAttribute('items').slice(1), () => {
      //     for (const child of Array.from(this.children)) {
      //
      //     }
      // });
    }
  }
);
