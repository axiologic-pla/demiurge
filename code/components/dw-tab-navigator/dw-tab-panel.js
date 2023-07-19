const template = document.createElement('template');

template.innerHTML = `
<style>
.tabs {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
}

.tabs ::slotted(div[slot="tab"]) {
    user-select: none;
    cursor: pointer;
    background-color: #51AE8F;
    font-size: 1rem;
    color: white;
    flex-grow: 1;
    text-align: center;
    line-height: 1.5;
}

.tabs ::slotted(div[slot="tab"].selected) {
    background-color: #328569;
}

.tab-contents ::slotted(*) {
    display: none;
}

.tab-contents ::slotted(.selected) {
    display: block;
    padding: 5px;
}

</style>
 <div class="tabs">
    <slot id="tab-slot" name="tab" class="tab-header"></slot> 
 </div>
 <div class="tab-contents">
    <slot id="content-slot" name="content" class="tab-content"></slot>
 </div>
`;

export default class DwTabNavigator extends HTMLElement {
  static observedAttributes = ["selected-index", "direction"];


  constructor() {
    super();
    this._selectedIndex = 0;
    this._direction = "row";
    this.shadow = this.attachShadow({mode: "open"});
    this.shadowRoot.appendChild(template.content.cloneNode(true));
  }


  async connectedCallback() {
    this.setAttribute("selectedIndex", this._selectedIndex);
    this.dom = {
      tabSlot: this.shadow.querySelector(".tab-header"),
      contentSlot: this.shadow.querySelector(".tab-content")
    };
    this.dom.tabs = this.dom.tabSlot.assignedElements();
    this.dom.contents = this.dom.contentSlot.assignedElements();
    this.attachEvents();
    this.selectTabByIndex(this._selectedIndex);
    /*this.dom.tabs[this._selectedIndex]?.classList.add("selected");
    this.dom.contents[this._selectedIndex]?.classList.add("selected");*/
    this.dom.tabs.forEach(tabItem => {
      tabItem.style.maxWidth = `${100 / this.dom.tabs.length}%`
    })
  }


  attachEvents() {
    this.dom.tabs.forEach(tabItem => {
      tabItem.addEventListener("click", this.onTabClick, {bubbles: true});
    })

    /* this.dom.tabSlot.addEventListener("slotchange", this.onTabSlotChange);
     this.dom.contentSlot.addEventListener("slotchange", this.onContentSlotChange);*/
  }

  onTabSlotChange() {
    this.dom.tabs = this.dom.tabSlot.assignedElements();
  }

  onContentSlotChange() {
    this.dom.contents = this.dom.contentSlot.assignedElements();
  }

  onTabClick(e) {
    let tabIndex = this.dom.tabs.indexOf(e.currentTarget);
    this.selectTabByIndex(tabIndex);
  }

  selectTabByIndex(index) {
    const tab = this.dom.tabs[index];
    const content = this.dom.contents[index];
    this.setAttribute("selectedIndex", index);
    if (!tab || !content) return;
    this.dom.contents.forEach(p => p.classList.remove("selected"));
    this.dom.tabs.forEach(p => p.classList.remove("selected"));
    content.classList.add("selected");
    tab.classList.add("selected");

  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      if (name === "selected-index") {
        this.selectedIndex = newValue;
      } else {
        this[name] = newValue;
      }
    }
  }

  disconnectedCallback() {
    if (this.dom.tabs) {
      this.dom.tabs.forEach(tabItem => {
        tabItem.removeEventListener("click", this.onTabClick)
      })
    }
    this.innerHTML = "";
  }

  set selectedIndex(value) {
    this._selectedIndex = value;
  }

  get selectedIndex() {
    return this._selectedIndex;
  }

  set direction(value) {
    this._direction = value;
    this.setAttribute("direction", value);
  }

  get direction() {
    return this._direction;
  }
}
customElements.define("dw-tab-navigator", DwTabNavigator);
