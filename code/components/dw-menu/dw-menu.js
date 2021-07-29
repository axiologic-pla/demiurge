customElements.define(
  'dw-menu',
  class _ extends HTMLElement {
    constructor() {
      super();

      this.innerHTML = `
            <link rel="stylesheet" href="components/dw-menu/dw-menu.css">
            <sl-drawer placement="start" class="dw-drawer" no-header style="z-index: 1001">
                <webc-app-menu></webc-app-menu>
            </sl-drawer>
        `;

      this.drawerElement = this.querySelector('sl-drawer');
    }

    connectedCallback() {
      const menuElement = this.querySelector('webc-app-menu');

      const addMenuItemsListeners = () => {
        const items = this.querySelectorAll('webc-app-menu-item');
        for (const itemElement of Array.from(items)) {
          if (itemElement.hasAttribute('dw-menu-item')) {
            continue;
          }
          itemElement.setAttribute('dw-menu-item', '');
          itemElement.addEventListener('click', async () => {
            await this.drawerElement.hide();
          });
        }
      };

      menuElement.componentOnReady().then(() => {
        // this is quite a hack for a known limitation
        // since webc-app-menu has an empty innerHTML (webc-app-menu-items are not rendered yet)
        // but component is ready
        const interval = setInterval(() => {
          if (menuElement.innerHTML !== '<!---->') {
            addMenuItemsListeners();
            clearInterval(interval);
          }
        }, 10);
      });
    }

    show() {
      setTimeout(async () => {
        await this.drawerElement.show();
      });
    }

    hide() {
      setTimeout(async () => {
        this.drawerElement.hide();
      });
    }
  }
);
