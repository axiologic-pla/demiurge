// src/internal/focus-visible.ts
var listeners = new WeakMap();
function observe(el, options) {
  const keys = ["Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageDown", "PageUp"];
  const is = (event) => {
    if (keys.includes(event.key)) {
      el.classList.add("focus-visible");
      if (options == null ? void 0 : options.visible) {
        options.visible();
      }
    }
  };
  const isNot = () => {
    el.classList.remove("focus-visible");
    if (options == null ? void 0 : options.notVisible) {
      options.notVisible();
    }
  };
  listeners.set(el, { is, isNot });
  el.addEventListener("keydown", is);
  el.addEventListener("keyup", is);
  el.addEventListener("mousedown", isNot);
  el.addEventListener("mouseup", isNot);
}
function unobserve(el) {
  const { is, isNot } = listeners.get(el);
  el.classList.remove("focus-visible");
  el.removeEventListener("keydown", is);
  el.removeEventListener("keyup", is);
  el.removeEventListener("mousedown", isNot);
  el.removeEventListener("mouseup", isNot);
}
var focusVisible = {
  observe,
  unobserve
};

export {
  focusVisible
};
