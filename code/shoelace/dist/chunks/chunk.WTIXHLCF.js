import {
  focusVisible
} from "./chunk.FNYMNAKO.js";
import {
  getTextContent
} from "./chunk.IBDZI3K2.js";
import {
  emit
} from "./chunk.I4TE3TJV.js";
import {
  component_styles_default
} from "./chunk.LERSXYXA.js";
import {
  n,
  o
} from "./chunk.VRIBQCTO.js";
import {
  T,
  h,
  i
} from "./chunk.4WUNMDF2.js";
import {
  __decorateClass
} from "./chunk.IHGPZX35.js";

// src/components/menu/menu.styles.ts
var menu_styles_default = i`
  ${component_styles_default}

  :host {
    display: block;
  }

  .menu {
    padding: var(--sl-spacing-x-small) 0;
  }
`;

// src/components/menu/menu.ts
var SlMenu = class extends h {
  constructor() {
    super(...arguments);
    this.typeToSelectString = "";
  }
  connectedCallback() {
    super.connectedCallback();
    focusVisible.observe(this, {
      visible: () => this.getAllItems().map((item) => item.classList.add("sl-focus-visible")),
      notVisible: () => this.getAllItems().map((item) => item.classList.remove("sl-focus-visible"))
    });
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    focusVisible.unobserve(this);
  }
  getAllItems(options = { includeDisabled: true }) {
    return [...this.defaultSlot.assignedElements({ flatten: true })].filter((el) => {
      if (el.getAttribute("role") !== "menuitem") {
        return false;
      }
      if (!(options == null ? void 0 : options.includeDisabled) && el.disabled) {
        return false;
      }
      return true;
    });
  }
  getCurrentItem() {
    return this.getAllItems({ includeDisabled: false }).find((i2) => i2.getAttribute("tabindex") === "0");
  }
  setCurrentItem(item) {
    const items = this.getAllItems({ includeDisabled: false });
    let activeItem = item.disabled ? items[0] : item;
    items.map((i2) => i2.setAttribute("tabindex", i2 === activeItem ? "0" : "-1"));
  }
  typeToSelect(key) {
    const items = this.getAllItems({ includeDisabled: false });
    clearTimeout(this.typeToSelectTimeout);
    this.typeToSelectTimeout = setTimeout(() => this.typeToSelectString = "", 750);
    this.typeToSelectString += key.toLowerCase();
    this.getAllItems().map((item) => item.classList.add("sl-focus-visible"));
    for (const item of items) {
      const slot = item.shadowRoot.querySelector("slot:not([name])");
      const label = getTextContent(slot).toLowerCase().trim();
      if (label.substring(0, this.typeToSelectString.length) === this.typeToSelectString) {
        this.setCurrentItem(item);
        item.focus();
        break;
      }
    }
  }
  handleClick(event) {
    const target = event.target;
    const item = target.closest("sl-menu-item");
    if (item && !item.disabled) {
      emit(this, "sl-select", { detail: { item } });
    }
  }
  handleKeyDown(event) {
    if (event.key === "Enter") {
      const item = this.getCurrentItem();
      event.preventDefault();
      if (item) {
        item.click();
      }
    }
    if (event.key === " ") {
      event.preventDefault();
    }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      const items = this.getAllItems({ includeDisabled: false });
      const activeItem = this.getCurrentItem();
      let index = activeItem ? items.indexOf(activeItem) : 0;
      if (items.length) {
        event.preventDefault();
        if (event.key === "ArrowDown") {
          index++;
        } else if (event.key === "ArrowUp") {
          index--;
        } else if (event.key === "Home") {
          index = 0;
        } else if (event.key === "End") {
          index = items.length - 1;
        }
        if (index < 0)
          index = 0;
        if (index > items.length - 1)
          index = items.length - 1;
        this.setCurrentItem(items[index]);
        items[index].focus();
        return;
      }
    }
    this.typeToSelect(event.key);
  }
  handleMouseDown(event) {
    const target = event.target;
    if (target.getAttribute("role") === "menuitem") {
      this.setCurrentItem(target);
      target.focus();
    }
  }
  handleSlotChange() {
    const items = this.getAllItems({ includeDisabled: false });
    if (items.length) {
      this.setCurrentItem(items[0]);
    }
  }
  render() {
    return T`
      <div
        part="base"
        class="menu"
        role="menu"
        @click=${this.handleClick}
        @keydown=${this.handleKeyDown}
        @mousedown=${this.handleMouseDown}
      >
        <slot @slotchange=${this.handleSlotChange}></slot>
      </div>
    `;
  }
};
SlMenu.styles = menu_styles_default;
__decorateClass([
  o(".menu")
], SlMenu.prototype, "menu", 2);
__decorateClass([
  o("slot")
], SlMenu.prototype, "defaultSlot", 2);
SlMenu = __decorateClass([
  n("sl-menu")
], SlMenu);
var menu_default = SlMenu;

export {
  menu_default
};
