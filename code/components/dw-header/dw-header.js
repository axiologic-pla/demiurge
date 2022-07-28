customElements.define(
  'dw-header',
  class _ extends HTMLElement {
    constructor() {
      super();
      /*
      * TO DO:
      * check how to reload iframe on click.
      *  <stencil-route-link class="logo" url="/"> doesn't work
      *
      * */
      this.innerHTML = `
            <link rel="stylesheet" href="./components/dw-header/dw-header.css">
            <header>
                <webc-app-menu mode="horizontal">
                    <div slot="before">
                        <stencil-route-link class="logo">
                            Demiurge Wallet
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
