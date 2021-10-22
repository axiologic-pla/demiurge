import {
  getIconLibrary,
  unwatchIcon,
  watchIcon
} from "./chunk.L23EKU34.js";
import {
  requestIcon
} from "./chunk.ARRH633M.js";
import {
  i as i2,
  s,
  t
} from "./chunk.VIWFLAGR.js";
import {
  watch
} from "./chunk.BD26TKS4.js";
import {
  emit
} from "./chunk.I4TE3TJV.js";
import {
  component_styles_default
} from "./chunk.LERSXYXA.js";
import {
  e,
  n,
  r
} from "./chunk.VRIBQCTO.js";
import {
  A,
  T,
  h,
  i,
  w
} from "./chunk.4WUNMDF2.js";
import {
  __decorateClass
} from "./chunk.IHGPZX35.js";

// node_modules/lit-html/directives/unsafe-html.js
var n2 = class extends s {
  constructor(i3) {
    if (super(i3), this.vt = A, i3.type !== t.CHILD)
      throw Error(this.constructor.directiveName + "() can only be used in child bindings");
  }
  render(r2) {
    if (r2 === A)
      return this.Vt = void 0, this.vt = r2;
    if (r2 === w)
      return r2;
    if (typeof r2 != "string")
      throw Error(this.constructor.directiveName + "() called with a non-string value");
    if (r2 === this.vt)
      return this.Vt;
    this.vt = r2;
    const s2 = [r2];
    return s2.raw = s2, this.Vt = { _$litType$: this.constructor.resultType, strings: s2, values: [] };
  }
};
n2.directiveName = "unsafeHTML", n2.resultType = 1;
var o = i2(n2);

// node_modules/lit-html/directives/unsafe-svg.js
var t2 = class extends n2 {
};
t2.directiveName = "unsafeSVG", t2.resultType = 2;
var o2 = i2(t2);

// src/components/icon/icon.styles.ts
var icon_styles_default = i`
  ${component_styles_default}

  :host {
    display: inline-block;
    width: 1em;
    height: 1em;
    contain: strict;
    box-sizing: content-box !important;
  }

  .icon,
  svg {
    display: block;
    height: 100%;
    width: 100%;
  }
`;

// src/components/icon/icon.ts
var parser = new DOMParser();
var SlIcon = class extends h {
  constructor() {
    super(...arguments);
    this.svg = "";
    this.library = "default";
  }
  connectedCallback() {
    super.connectedCallback();
    watchIcon(this);
  }
  firstUpdated() {
    this.setIcon();
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    unwatchIcon(this);
  }
  getLabel() {
    let label = "";
    if (this.label) {
      label = this.label;
    } else if (this.name) {
      label = this.name.replace(/-/g, " ");
    } else if (this.src) {
      label = this.src.replace(/.*\//, "").replace(/-/g, " ").replace(/\.svg/i, "");
    }
    return label;
  }
  getUrl() {
    const library = getIconLibrary(this.library);
    if (this.name && library) {
      return library.resolver(this.name);
    } else {
      return this.src;
    }
  }
  redraw() {
    this.setIcon();
  }
  async setIcon() {
    const library = getIconLibrary(this.library);
    const url = this.getUrl();
    if (url) {
      try {
        const file = await requestIcon(url);
        if (url !== this.getUrl()) {
          return;
        } else if (file.ok) {
          const doc = parser.parseFromString(file.svg, "text/html");
          const svgEl = doc.body.querySelector("svg");
          if (svgEl) {
            if (library && library.mutator) {
              library.mutator(svgEl);
            }
            this.svg = svgEl.outerHTML;
            emit(this, "sl-load");
          } else {
            this.svg = "";
            emit(this, "sl-error", { detail: { status: file.status } });
          }
        } else {
          this.svg = "";
          emit(this, "sl-error", { detail: { status: file.status } });
        }
      } catch (e2) {
        emit(this, "sl-error", { detail: { status: -1 } });
      }
    } else if (this.svg) {
      this.svg = "";
    }
  }
  handleChange() {
    this.setIcon();
  }
  render() {
    return T` <div part="base" class="icon" role="img" aria-label=${this.getLabel()}>${o2(this.svg)}</div>`;
  }
};
SlIcon.styles = icon_styles_default;
__decorateClass([
  r()
], SlIcon.prototype, "svg", 2);
__decorateClass([
  e()
], SlIcon.prototype, "name", 2);
__decorateClass([
  e()
], SlIcon.prototype, "src", 2);
__decorateClass([
  e()
], SlIcon.prototype, "label", 2);
__decorateClass([
  e()
], SlIcon.prototype, "library", 2);
__decorateClass([
  watch("name"),
  watch("src"),
  watch("library")
], SlIcon.prototype, "setIcon", 1);
SlIcon = __decorateClass([
  n("sl-icon")
], SlIcon);
var icon_default = SlIcon;

export {
  o,
  icon_default
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
