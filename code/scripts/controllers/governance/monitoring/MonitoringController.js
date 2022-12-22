import constants from '../../../constants.js';

const { DwController } = WebCardinal.controllers;

class MonitoringUI extends DwController {
  constructor(...props) {
    super(...props);
  }

  getInitialViewModel() {
    return {
      url: '',
      displayUrl: '',
      hasUrl: false
    };
  }
}

class MonitoringController extends DwController {
  constructor(...props) {
    super(...props);

    this.ui.page = new MonitoringUI(...props);
    this.model = this.ui.page.getInitialViewModel();

    this.init();
  }

  init() {
    this.attachViewListeners();
    this.updateModel();
  }

  attachViewListeners() {
    this.attachInputUrlHandler();
    this.attachPasteHandler();
    this.attachAddUrlHandler();
    this.attachClearUrlHandler();
  }

  attachPasteHandler() {
    this.onTagClick('url.paste', async (model, target) => {
      try {
        const result = await navigator.permissions.query({
          name: 'clipboard-read'
        });
        if (result.state === 'granted' || result.state === 'prompt') {
          const url = await navigator.clipboard.readText();
          target.parentElement.value = url;
          return { url };
        }
        throw Error('Coping from clipboard is not possible!');
      } catch (err) {
        target.remove();
        console.log(err);
        return '';
      }
    });
  }

  attachAddUrlHandler() {
    this.onTagClick('url.add', async () => {
      const selectedOrganization = this.model.toObject('selectedOrganization');
      selectedOrganization.monitoringUrl = this.model.url;
      await this.sharedStorageService.updateRecordAsync(constants.TABLES.GOVERNANCE_ORGANIZATIONS, selectedOrganization.pk, selectedOrganization);

      this.model.displayUrl = this.model.url;
      this.model.hasUrl = this.model.displayUrl.trim().length > 0;
    });
  }

  attachClearUrlHandler() {
    this.onTagClick('url.remove', async () => {
      const selectedOrganization = this.model.toObject('selectedOrganization');
      selectedOrganization.monitoringUrl = '';
      await this.sharedStorageService.updateRecordAsync(constants.TABLES.GOVERNANCE_ORGANIZATIONS, selectedOrganization.pk, selectedOrganization);

      this.model.displayUrl = '';
      this.model.hasUrl = false;
    });
  }

  updateModel() {
    const selectedOrganization = this.model.toObject('selectedOrganization');
    this.model.url = selectedOrganization.monitoringUrl || '';
    this.model.displayUrl = selectedOrganization.monitoringUrl || '';
    this.model.hasUrl = this.model.url.trim().length > 0;
  }

  attachInputUrlHandler() {
    const htmlEl = document.querySelector('#url-input');
    const handler = (event) => {
      this.model.url = event.target.value;
    };
    htmlEl.addEventListener('sl-change', handler);
    htmlEl.addEventListener('sl-input', handler);
  }
}

export default MonitoringController;
export { MonitoringUI };