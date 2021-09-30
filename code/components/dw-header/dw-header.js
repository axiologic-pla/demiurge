customElements.define(
  'dw-header',
  class _ extends HTMLElement {
    constructor() {
      super();

      this.innerHTML = `
            <link rel="stylesheet" href="./components/dw-header/dw-header.css">
            <header>
                <webc-app-menu mode="horizontal">
                    <div slot="before">
                        <stencil-route-link class="logo" url="/">
                            <strong>Demiurge</strong>
                            <span>Wallet</span>
                        </stencil-route-link>
                    </div>
                    <div slot="after">
                        <sl-icon-button burger name="list"></sl-icon-button>
                    </div>
                </webc-app-menu>
            </header>
        `;

      const burgerElement = this.querySelector('sl-icon-button[burger]');
      const menuElement = document.querySelector('dw-menu');
      burgerElement.addEventListener('click', () => {
        menuElement.show();
      });
    }
  }
);
