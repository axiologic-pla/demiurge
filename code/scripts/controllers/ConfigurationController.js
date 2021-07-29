const { Controller } = WebCardinal.controllers;

export default class ConfigurationController extends Controller {
  constructor(...props) {
    super(...props);

    this.model = {};
  }

  async onReady() {
    super.onReady();

    const container = this.getElementByTag("jsoneditor");
    const options = {
      modes: ["tree", "code"],
    };
    const editor = new JSONEditor(container, options);

    // set json
    const initialJson = {
      default: {
        replicas: [],
        brickStorages: ["$ORIGIN"],
        anchoringServices: ["$ORIGIN"],
      },
      epi: {
        replicas: [],
        brickStorages: ["$ORIGIN"],
        anchoringServices: ["$ORIGIN"],
      },
      predefined: {
        replicas: [],
        brickStorages: ["$ORIGIN"],
        anchoringServices: ["$ORIGIN"],
      },
      epidev: {
        replicas: [],
        brickStorages: ["$ORIGIN"],
        anchoringServices: ["$ORIGIN"],
      },
      "mah1.epidev": {
        replicas: [],
        brickStorages: ["$ORIGIN"],
        anchoringServices: ["$ORIGIN"],
      },
      "mah2.epidev": {
        replicas: [],
        brickStorages: ["$ORIGIN"],
        anchoringServices: ["$ORIGIN"],
      },
      epiqa: {
        replicas: [],
        brickStorages: ["$ORIGIN"],
        anchoringServices: ["$ORIGIN"],
      },
      vault: {
        replicas: [],
        brickStorages: ["$ORIGIN"],
        anchoringServices: ["$ORIGIN"],
      },
      "vault.nvs": {
        replicas: [],
        brickStorages: ["$ORIGIN"],
        anchoringServices: ["$ORIGIN"],
      },
    };
    editor.set(initialJson);

    // get json
    const updatedJson = editor.get();
  }
}
