import { createSlotElement, escapeHTML } from "../utils.js";

customElements.define(
  "dw-title",
  class _ extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });

      const linkElement = document.createElement("link");
      linkElement.setAttribute("rel", "stylesheet");
      linkElement.setAttribute("href", "components/dw-title/dw-title.css");

      const headerElement = document.createElement("h2");
      headerElement.classList.add("header");
      headerElement.setAttribute("part", "header");
      headerElement.append(createSlotElement());

      const wrapperElement = document.createElement("div");
      wrapperElement.classList.add("base");
      wrapperElement.setAttribute("part", "base");
      wrapperElement.append(linkElement, headerElement, createSlotElement("subheader"));

      if (this.hasAttribute("header")) {
        this.append(escapeHTML(this.getAttribute("header")));
      }

      if (this.hasAttribute("subheader")) {
        const subheaderElement = document.createElement("p");
        subheaderElement.setAttribute("slot", "subheader");
        subheaderElement.innerText = escapeHTML(this.getAttribute("subheader"));
        this.append(subheaderElement);
      }

      this.shadowRoot.append(wrapperElement);
    }
  }
);
