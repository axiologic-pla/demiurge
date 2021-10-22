import {
  focusVisible
} from "./chunk.FNYMNAKO.js";
import {
  l
} from "./chunk.CXQBDYM7.js";
import {
  e as e2
} from "./chunk.7QWA24FS.js";
import {
  component_styles_default
} from "./chunk.LERSXYXA.js";
import {
  e,
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

// src/components/icon-button/icon-button.styles.ts
var icon_button_styles_default = i`
  ${component_styles_default}

  :host {
    display: inline-block;
  }

  .icon-button {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    background: none;
    border: none;
    border-radius: var(--sl-border-radius-medium);
    font-size: inherit;
    color: rgb(var(--sl-color-neutral-600));
    padding: var(--sl-spacing-x-small);
    cursor: pointer;
    transition: var(--sl-transition-medium) color;
    -webkit-appearance: none;
  }

  .icon-button:hover:not(.icon-button--disabled),
  .icon-button:focus:not(.icon-button--disabled) {
    color: rgb(var(--sl-color-primary-600));
  }

  .icon-button:active:not(.icon-button--disabled) {
    color: rgb(var(--sl-color-primary-700));
  }

  .icon-button:focus {
    outline: none;
  }

  .icon-button--disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .focus-visible.icon-button:focus {
    box-shadow: 0 0 0 var(--sl-focus-ring-width) rgb(var(--sl-color-primary-500) / var(--sl-focus-ring-alpha));
  }
`;

// src/components/icon-button/icon-button.ts
var SlIconButton = class extends h {
  constructor() {
    super(...arguments);
    this.label = "";
    this.disabled = false;
  }
  connectedCallback() {
    super.connectedCallback();
    this.updateComplete.then(() => focusVisible.observe(this.button));
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    focusVisible.unobserve(this.button);
  }
  render() {
    const isLink = this.href ? true : false;
    const interior = T`
      <sl-icon
        name=${l(this.name)}
        library=${l(this.library)}
        src=${l(this.src)}
        aria-hidden="true"
      ></sl-icon>
    `;
    return isLink ? T`
          <a
            part="base"
            class="icon-button"
            href=${l(this.href)}
            target=${l(this.target)}
            download=${l(this.download)}
            rel=${l(this.target ? "noreferrer noopener" : void 0)}
            role="button"
            aria-disabled=${this.disabled ? "true" : "false"}
            aria-label="${this.label}"
            tabindex=${this.disabled ? "-1" : "0"}
          >
            ${interior}
          </a>
        ` : T`
          <button
            part="base"
            class=${e2({
      "icon-button": true,
      "icon-button--disabled": this.disabled
    })}
            ?disabled=${this.disabled}
            type="button"
            aria-label=${this.label}
          >
            ${interior}
          </button>
        `;
  }
};
SlIconButton.styles = icon_button_styles_default;
__decorateClass([
  o("button")
], SlIconButton.prototype, "button", 2);
__decorateClass([
  e()
], SlIconButton.prototype, "name", 2);
__decorateClass([
  e()
], SlIconButton.prototype, "library", 2);
__decorateClass([
  e()
], SlIconButton.prototype, "src", 2);
__decorateClass([
  e()
], SlIconButton.prototype, "href", 2);
__decorateClass([
  e()
], SlIconButton.prototype, "target", 2);
__decorateClass([
  e()
], SlIconButton.prototype, "download", 2);
__decorateClass([
  e()
], SlIconButton.prototype, "label", 2);
__decorateClass([
  e({ type: Boolean, reflect: true })
], SlIconButton.prototype, "disabled", 2);
SlIconButton = __decorateClass([
  n("sl-icon-button")
], SlIconButton);
var icon_button_default = SlIconButton;

export {
  icon_button_default
};
