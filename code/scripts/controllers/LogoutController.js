const {DwController} = WebCardinal.controllers;

export default class LogoutController extends DwController {
  constructor(...props) {
    super(...props);
    window.WebCardinal.loader.hidden = false;
    window.top.location = "/logout";
  }
}
