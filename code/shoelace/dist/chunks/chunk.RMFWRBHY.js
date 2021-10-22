import {
  i,
  s,
  t
} from "./chunk.VIWFLAGR.js";
import {
  A,
  w
} from "./chunk.4WUNMDF2.js";

// node_modules/lit-html/directive-helpers.js
var d = (o) => o.strings === void 0;
var s2 = {};
var f = (o, t2 = s2) => o.H = t2;

// node_modules/lit-html/directives/live.js
var l = i(class extends s {
  constructor(r) {
    if (super(r), r.type !== t.PROPERTY && r.type !== t.ATTRIBUTE && r.type !== t.BOOLEAN_ATTRIBUTE)
      throw Error("The `live` directive is not allowed on child or event bindings");
    if (!d(r))
      throw Error("`live` bindings can only contain a single expression");
  }
  render(r) {
    return r;
  }
  update(i2, [t2]) {
    if (t2 === w || t2 === A)
      return t2;
    const o = i2.element, l2 = i2.name;
    if (i2.type === t.PROPERTY) {
      if (t2 === o[l2])
        return w;
    } else if (i2.type === t.BOOLEAN_ATTRIBUTE) {
      if (!!t2 === o.hasAttribute(l2))
        return w;
    } else if (i2.type === t.ATTRIBUTE && o.getAttribute(l2) === t2 + "")
      return w;
    return f(i2), t2;
  }
});

export {
  l
};
/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
