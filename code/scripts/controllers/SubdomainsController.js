const {DataSource} = WebCardinal.dataSources;
const {DwController} = WebCardinal.controllers;

const rootDomains = ["domain1", "domain2", "domain3", "domain4"];
const subDomains = {
  domain1: ["subdomain11", "subdomain12", "subdomain13"],
  domain2: ["subdomain21", "subdomain22"],
  domain3: [],
  domain4: ["subdomain41"]
};
const domainsData = {
  domain1: [
    {
      type: "Anchoring",
      name: "NVS",
      validFrom: "15/05/2020",
      expireAt: "15/05/2022",
      controllers: "1"
    },
    {
      type: "Bricking",
      name: "NVS",
      validFrom: "15/05/2020",
      expireAt: "-",
      controllers: "2"
    }
  ],
  subdomain11: [{
    type: "Anchoring",
    name: "NVS",
    validFrom: "15/05/2020",
    expireAt: "15/05/2022",
    controllers: "1"
  }, {type: "Bricking", name: "MSD", validFrom: "01/01/2022", expireAt: "-", controllers: "11"}, {
    type: "MQ",
    name: "MSD",
    validFrom: "15/05/2020",
    expireAt: "15/05/2022",
    controllers: "3"
  }],
  subdomain41: [{
    type: "Anchoring",
    name: "NVS",
    validFrom: "15/05/2020",
    expireAt: "15/05/2022",
    controllers: "1"
  }, {type: "Bricking", name: "NVS", validFrom: "10/05/2019", expireAt: "-", controllers: "41"}, {
    type: "MQ",
    name: "MSD",
    validFrom: "15/05/2020",
    expireAt: "15/05/2022",
    controllers: "3"
  }]
};

class domainsDataSource extends DataSource {
  constructor(...props) {
    super(...props);
    this.setPageSize(2);
    this.hasMoreLogs = false;
    this.subdomainsArr = [];
  }

  async getPageDataAsync(startOffset, dataLengthForCurrentPage) {
    let results = this.subdomainsArr;

    if (results.length === 0) {
      document.querySelector(".pagination-container").style.visibility = "hidden";
      return results;
    }
    document.querySelector(".pagination-container").style.visibility = "visible";

    this.hasMoreLogs = results.length >= startOffset + dataLengthForCurrentPage + 1;

    if (!this.hasMoreLogs) {
      document.querySelector(".next-page-btn").disabled = true;
    } else {
      document.querySelector(".next-page-btn").disabled = false;
    }

    results = results.slice(startOffset, startOffset + dataLengthForCurrentPage);

    return results;
  }
}

class treeDataSource extends DataSource {
  constructor(...props) {
    super(...props);
    this.treeData = [];
    this.selectedTreeNode = "root";
  }

  async getPageDataAsync(startOffset, dataLengthForCurrentPage) {
    let results = [];
    if (this.selectedTreeNode === "root") {
      results = await this.getRooDomains()
    } else {
      Array.from(document.querySelector(`#treeNode-${this.selectedTreeNode}`).children).forEach(child => child.remove());
      results = await this.getSelectedTreeNode(this.selectedTreeNode);
    }
    this.populateComponent(results, this.selectedTreeNode);
    return results;
  }

  populateComponent(arr, selectedTreeNode) {
    let elemntsToAppend = [];
    arr.forEach((item, index) => {
      let menuItem = `<sl-menu-item data-tag="subdomainClick" item-data=${item}  id="treeNode-${item}">${item}</sl-menu-item>`;
      if (selectedTreeNode === "root") {
        document.querySelector("#domains-panel").appendChild(htmlToElement(menuItem));
      } else {
        document.querySelector(`#treeNode-${selectedTreeNode}`).appendChild(htmlToElement(menuItem));
      }
    })
  }

  awaitTimeout = delay => new Promise(resolve => setTimeout(resolve, delay));

  async getRooDomains() {
    await this.awaitTimeout(2 * 1000);
    return rootDomains;
  }

  async getSelectedTreeNode(node) {
    await this.awaitTimeout(2 * 1000);
    return subDomains[node] || [];
  }
}

export default class SubdomainsController extends DwController {

  constructor(...props) {
    super(...props);
    const {ui} = this;
    this.model = {
      domain: "root",
      domainsDataSource: new domainsDataSource(),
      treeDataSource: new treeDataSource()
    };
    this.model.treeDataSource.getPageDataAsync();

    this.onTagClick("prev-page", async (model, target, event) => {
      target.parentElement.querySelector(".next-page-btn").disabled = false;
      if (this.model.domainsDataSource.getCurrentPageIndex() > 0) {
        await this.model.domainsDataSource.goToPreviousPage();
        if (this.model.domainsDataSource.getCurrentPageIndex() === 0) {
          target.disabled = true;
        } else {
          target.disabled = false;
        }
      } else {
        target.disabled = true;
        return;
      }

    })
    this.onTagClick("next-page", (model, target, event) => {
      target.parentElement.querySelector(".prev-page-btn").disabled = false;
      if (this.model.domainsDataSource.hasMoreLogs) {
        this.model.domainsDataSource.goToNextPage();
      }
    })

    this.onTagClick("add-domain", async () => {
      await ui.showDialogFromComponent(
        "dw-dialog-add-domain",
        {},
        {
          parentElement: this.element,
        }
      );
    })
    this.onTagClick("add-domain-confirm", async (model, button) => {
      let newDomain = document.querySelector("#new-domain-input").value;
      await ui.hideDialogFromComponent("dw-dialog-add-domain");
      if (!newDomain) {
        return;
      }

      rootDomains.push(newDomain);
      let menuItem = `<sl-menu-item data-tag="subdomainClick" item-data=${newDomain}  id="treeNode-${newDomain}">${newDomain}</sl-menu-item>`;
      document.querySelector("#domains-panel").appendChild(htmlToElement(menuItem));
      await this.updateView(newDomain);

    });
    this.onTagClick("add-domain-cancel", async (model, button) => {
      await ui.hideDialogFromComponent("dw-dialog-add-domain");
    })


    /* this.model.onChange("rootdomains", async () => {
       this.model.treeDataSource.treeData = this.model.rootdomains
       //  this.populateSubdomains(this.model.subdomains, 0, 0);
       //await Promise.all([UI.showTooltipForSubdomains(this.element), UI.showInputForSubdomains(this.element)]);
     });*/

    /*    this.onTagClick("subdomain.select", async (...props) => {
          const subdomain = UI.selectSubdomain(...props);

          if (!subdomain) {
            this.model.domain = "root";
            return;
          }

          this.model.domain = [subdomain.name, "root"].join(".");
        });*/

    /*    this.onTagClick("subdomain.add", async () => {
          this.model.subdomains.push(this.model.subdomain);
        });*/

    /*    this.onTagEvent("subdomain.input", "sl-input", (model, target) => {
          this.model.subdomain = {
            name:
              this.model.domain === "root"
                ? target.value
                : [target.value, ...this.model.domain.split(".")].slice(0, -1).join("."),
            value: "TODO_UID",
          };
        });*/

    this.onTagClick("subdomainClick", async (model, target, event) => {
      let itemData = target.getAttribute("item-data");
      await this.updateView(itemData);
    })

  }

  async updateView(selectedTreeItem) {
    window.WebCardinal.loader.hidden = false;
    this.model.domainsDataSource.subdomainsArr = domainsData[selectedTreeItem] || [];
    this.model.treeDataSource.selectedTreeNode = selectedTreeItem;
    await this.model.treeDataSource.getPageDataAsync();
    await this.model.domainsDataSource.goToPageByIndex(0);
    window.WebCardinal.loader.hidden = true;
  }
}

let htmlToElement = function (html) {
  let template = document.createElement('template');
  html = html.trim(); // Never return a text node of whitespace as the result
  template.innerHTML = html;
  return template.content.firstChild;
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
