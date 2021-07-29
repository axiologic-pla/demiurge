const { Controller } = WebCardinal.controllers;

export default class SubdomainsController extends Controller {
  constructor(...props) {
    super(...props);

    this.model = {
      domain: "root",
      subdomains: [],
      subdomain: "",
    };

    setTimeout(() => {
      this.model.subdomains = [
        { name: "subdomain1", value: "value1" },
        { name: "subdomain2", value: "value2" },
        { name: "subdomain3", value: "value3" },
        { name: "subdomain4", value: "value4" },
      ];
    }, 1750);

    this.model.onChange("subdomains", async () => {
      await Promise.all([UI.showTooltipForSubdomains(this.element), UI.showInputForSubdomains(this.element)]);
    });

    this.onTagClick("subdomain.select", async (...props) => {
      const subdomain = UI.selectSubdomain(...props);

      if (!subdomain) {
        this.model.domain = "root";
        return;
      }

      this.model.domain = [subdomain.name, "root"].join(".");
    });

    this.onTagClick("subdomain.add", async () => {
      this.model.subdomains.push(this.model.subdomain);
    });

    this.onTagEvent("subdomain.input", "sl-input", (model, target) => {
      this.model.subdomain = {
        name:
          this.model.domain === "root"
            ? target.value
            : [target.value, ...this.model.domain.split(".")].slice(0, -1).join("."),
        value: "TODO_UID",
      };
    });
  }
}

// UI Only

const UI = {
  showTooltipForSubdomains: async (container) => {
    await container.componentOnReady();
    const subdomainsElement = container.querySelector("dw-subdomains");
    await subdomainsElement.componentOnReady();
    const tooltipElement = subdomainsElement.shadowRoot.querySelector("sl-tooltip");
    if (!tooltipElement.disabled) {
      return;
    }
    tooltipElement.disabled = false;
    await tooltipElement.show();
    tooltipElement.addEventListener("sl-hide", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    });
  },

  showInputForSubdomains: async (container) => {
    await container.componentOnReady();
    const additionElement = container.querySelector(".dw-subdomain-addition");
    if (additionElement) additionElement.hidden = false;
  },

  selectSubdomain: (model, target) => {
    if (target.checked) {
      target.checked = false;
      return undefined;
    }

    Array.from(target.parentElement.parentElement.children).forEach((subdomainElement) => {
      subdomainElement.firstElementChild.checked = false;
    });
    target.checked = true;
    return model;
  },
};
