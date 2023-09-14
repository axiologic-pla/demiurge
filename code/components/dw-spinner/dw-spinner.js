customElements.define(
  'dw-spinner',
  class _ extends HTMLElement {
    constructor() {
      super();

      this.pointsElement = document.createElement('span');
      setInterval(() => {
        if (this.pointsElement.innerText.length === 3) {
          this.pointsElement.innerText = '';
          return;
        }
        this.pointsElement.innerText += '.';
      }, 500);

      this.innerHTML = `
            <link rel="stylesheet" href="components/dw-spinner/dw-spinner.css">
            <div class="dw-spinner">
                <div>${this.getAttribute('content')}</div>
            </div>
        `;

      this.rootElement = this.querySelector('.dw-spinner');
      this.rootElement.append(this.pointsElement);
    }
  }
);
