const {DwController} = WebCardinal.controllers;

class GroupFeaturesController extends DwController {
  constructor(...props) {
    super(...props);

    let managedFeaturesArr = Object.keys(this.managedFeatures);
    for (let i = 0; i < managedFeaturesArr.length; i++) {
      let modelProp = managedFeaturesArr[i].replace("enable","disable")
      this.model[modelProp] = !this.managedFeatures[managedFeaturesArr[i]];
    }

  }

}

export default GroupFeaturesController
