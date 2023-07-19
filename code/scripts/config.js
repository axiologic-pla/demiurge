import {getWalletStatus, setWalletStatus} from "./services/BootingIdentityService.js";
import utils from "./utils.js";
import constants from "./constants.js";

const {getUserDetails, getUserInfo} = await import("./hooks/getUserDetails.js");
const openDSU = require("opendsu");
const didAPI = openDSU.loadAPI("w3cdid");
const typicalBusinessLogicHub = didAPI.getTypicalBusinessLogicHub();
const {setConfig, getConfig, addControllers, addHook, navigateToPageTag} = WebCardinal.preload;
const {define} = WebCardinal.components;
let userData;

function setInitialTheme() {
  function applyDarkTheme() {
    const schemeElement = document.head.querySelector("[name=color-scheme]");
    schemeElement.setAttribute("content", `${schemeElement.getAttribute("content")} dark`);
    document.body.classList.add("sl-theme-dark");
  }

  const storedTheme = window.localStorage.getItem("dw-theme");
  if (storedTheme === "dark") {
    applyDarkTheme();
    return;
  }
  if (storedTheme === "light") {
    return;
  }

  if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
    applyDarkTheme();
  }
}

async function setupGlobalErrorHandlers() {
  const {DwUI} = await import("./controllers/DwController.js");
  const dwUIInstance = new DwUI();
  let errHandler = openDSU.loadAPI("error");

  errHandler.observeUserRelevantMessages(constants.NOTIFICATION_TYPES.WARN, (notification) => {
    dwUIInstance.showToast(notification.message, {type: "warning"});
  });

  errHandler.observeUserRelevantMessages(constants.NOTIFICATION_TYPES.INFO, (notification) => {
    dwUIInstance.showToast(notification.message, {type: "info"})
  });

  errHandler.observeUserRelevantMessages(constants.NOTIFICATION_TYPES.ERROR, (notification) => {
    let errMsg = "";
    if (notification.err && notification.err.message) {
      errMsg = notification.err.message;
    }
    let toastMsg = `${notification.message} ${errMsg}`
    dwUIInstance.showToast(toastMsg, {type: "danger"})
  });
}

async function onUserLoginMessage(message) {
  await utils.addLogMessage(message.userDID, constants.OPERATIONS.LOGIN, message.userGroup, message.userId || "-", message.messageId)
}

async function onUserRemovedMessage(message) {
  let notificationHandler = openDSU.loadAPI("error");
  notificationHandler.reportUserRelevantWarning("Your account was deleted. Please contact an admin to see the reason");

  typicalBusinessLogicHub.stop();
//audit logs should already be registered during process message
  try {
    await utils.removeSharedEnclaveFromEnv();
    await setWalletStatus(constants.ACCOUNT_STATUS.WAITING_APPROVAL);
    $$.navigateToPage("groups");
  } catch (err) {
    $$.navigateToPage("groups");
  }
}

async function watchAndHandleExecution(fnc) {
  try {
    await fnc();
  } catch (err) {
    if (err.rootCause === "security") {
      await setWalletStatus(constants.ACCOUNT_STATUS.WAITING_APPROVAL);
      return;
    }
    if (window.confirm("Looks that your application is not properly initialized or in an invalid state. Would you like to reset it?")) {
      try {
        const response = await fetch("/removeSSOSecret/DSU_Fabric", {
          method: "DELETE",
          cache: "no-cache"
        })
        if (response.ok) {
          const basePath = window.location.href.split("loader")[0];
          $$.forceRedirect(basePath + "loader/newWallet.html");
        } else {
          let er = new Error(`Reset request failed (${response.status})`);
          er.rootCause = `statusCode: ${response.status}`;
          throw er;
        }
      } catch (err) {
        $$.showErrorAlert(`Failed to reset the application. RootCause: ${err.message}`);
        $$.forceTabRefresh();
      }
    } else {
      $$.showErrorAlert(`Application is an undesired state! It is a good idea to close all browser windows and try again!`);
      $$.forceTabRefresh();
    }
  }
  return true;
}

async function initializeWebCardinalConfig() {
  let userName = "-"
  const config = getConfig();
  config.translations = false;
  config.logLevel = "none";

  await watchAndHandleExecution(async () => {
    userData = await getUserDetails();
  });
  return config;
}

let config = await initializeWebCardinalConfig();

function finishInit() {
  setConfig(config);
  addHook(constants.HOOKS.BEFORE_APP_LOADS, async () => {
    // load Custom Components
    await import("../components/dw-header/dw-header.js");
    await import("../components/dw-menu/dw-menu.js");
    await import("../components/dw-spinner/dw-spinner.js");
    await import("../components/dw-title/dw-title.js");
    await import("../components/dw-data-grid/dw-data-grid.js");
    await import("../components/dw-clipboard-input/dw-clipboard-input.js");
    await import("../components/dw-copy-paste-input/dw-copy-paste-input.js");
    await import("../components/dw-tab-navigator/dw-tab-panel.js");
    typicalBusinessLogicHub.strongSubscribe(constants.MESSAGE_TYPES.USER_LOGIN, onUserLoginMessage);
    typicalBusinessLogicHub.strongSubscribe(constants.MESSAGE_TYPES.USER_REMOVED, onUserRemovedMessage);

    // load Demiurge base Controller
    const {DwController, setupDefaultModel} = await import("./controllers/DwController.js");
    await setupDefaultModel(userData);
    addControllers({DwController});

    await setupGlobalErrorHandlers();
    let status = await getWalletStatus();
    if (status === constants.ACCOUNT_STATUS.CREATED)
      await watchAndHandleExecution(async () => {
        await getUserInfo();
      })
  });

  addHook(constants.HOOKS.AFTER_APP_LOADS, async () => {
    await import("../components/did-generator/did-generator.js");
    const {getEnvironmentDataAsync} = await import("./hooks/getEnvironmentData.js");
    const envData = await getEnvironmentDataAsync() || {};
    const enableGovernance = envData.enableGovernance || false;

    document.querySelectorAll("webc-app-menu-item").forEach(item => {
      if (!item.querySelector("a")) {
        return;
      }

      const menuItemName = item.querySelector("a").innerHTML;
      item.setAttribute("icon-name", menuItemName);
      if (menuItemName === "My Identities") {
        item.querySelector("a").innerHTML = `<div class="menu-item-container">
        <svg xmlns="http://www.w3.org/2000/svg" width="55" height="56" viewBox="0 0 55 56" fill="none">
          <path d="M48.2751 45.3655C51.0764 41.9978 53.0247 38.0056 53.9553 33.7265C54.8858 29.4473 54.7712 25.0072 53.6211 20.7817C52.471 16.5563 50.3192 12.6697 47.3479 9.45084C44.3766 6.23198 40.6731 3.77554 36.5506 2.2893C32.4282 0.803057 28.0082 0.330748 23.6645 0.912326C19.3207 1.4939 15.1811 3.11226 11.5957 5.63049C8.01032 8.14872 5.08469 11.4927 3.06631 15.3797C1.04793 19.2666 -0.00382821 23.582 1.04701e-05 27.961C0.0014835 34.3268 2.24659 40.4887 6.34137 45.3655L6.30236 45.3986C6.4389 45.5623 6.59495 45.7026 6.73539 45.8644C6.91095 46.0652 7.10015 46.2542 7.28156 46.4491C7.82772 47.0416 8.38949 47.6107 8.97857 48.1447C9.15802 48.3084 9.34333 48.4605 9.52473 48.6164C10.1489 49.1543 10.7907 49.6649 11.4558 50.1405C11.5416 50.199 11.6197 50.275 11.7055 50.3354V50.312C16.274 53.5243 21.7239 55.2482 27.3102 55.2482C32.8965 55.2482 38.3464 53.5243 42.9149 50.312V50.3354C43.0007 50.275 43.0768 50.199 43.1646 50.1405C43.8278 49.663 44.4715 49.1543 45.0957 48.6164C45.2771 48.4605 45.4624 48.3065 45.6418 48.1447C46.2309 47.6088 46.7927 47.0416 47.3388 46.4491C47.5202 46.2542 47.7075 46.0652 47.885 45.8644C48.0235 45.7026 48.1815 45.5623 48.318 45.3967L48.2751 45.3655ZM27.3083 12.3691C29.0443 12.3691 30.7414 12.8835 32.1849 13.8472C33.6283 14.8109 34.7534 16.1807 35.4177 17.7832C36.0821 19.3858 36.2559 21.1493 35.9172 22.8506C35.5786 24.5519 34.7426 26.1146 33.515 27.3412C32.2874 28.5678 30.7234 29.4031 29.0207 29.7415C27.318 30.0799 25.5531 29.9062 23.9492 29.2424C22.3453 28.5786 20.9744 27.4544 20.0099 26.0121C19.0454 24.5699 18.5306 22.8742 18.5306 21.1395C18.5306 18.8135 19.4554 16.5827 21.1015 14.9379C22.7476 13.2931 24.9803 12.3691 27.3083 12.3691ZM11.7172 45.3655C11.751 42.8064 12.7919 40.3635 14.6145 38.5653C16.4372 36.7672 18.8951 35.7583 21.4565 35.757H33.16C35.7214 35.7583 38.1793 36.7672 40.002 38.5653C41.8246 40.3635 42.8655 42.8064 42.8993 45.3655C38.6214 49.2173 33.0669 51.349 27.3083 51.349C21.5496 51.349 15.9951 49.2173 11.7172 45.3655Z" />
        </svg>
       <span>My Identities</span></div>`
      }

      if (menuItemName === "Groups") {
        item.querySelector("a").innerHTML = `<div class="menu-item-container">
        <svg xmlns="http://www.w3.org/2000/svg" width="55" height="55" viewBox="0 0 55 55" fill="none"><circle cx="27.2887" cy="27.2887" r="27.2887" />
          <path fill-rule="evenodd" clip-rule="evenodd" d="M20.3266 16.7075C20.3266 14.8612 21.0601 13.0905 22.3656 11.785C23.6711 10.4795 25.4417 9.74609 27.288 9.74609C29.1343 9.74609 30.9049 10.4795 32.2104 11.785C33.5159 13.0905 34.2494 14.8612 34.2494 16.7075C34.2494 18.5537 33.5159 20.3244 32.2104 21.6299C30.9049 22.9354 29.1343 23.6688 27.288 23.6688C25.4417 23.6688 23.6711 22.9354 22.3656 21.6299C21.0601 20.3244 20.3266 18.5537 20.3266 16.7075ZM34.2494 22.2765C34.2494 20.7995 34.8361 19.383 35.8805 18.3386C36.9249 17.2942 38.3414 16.7075 39.8184 16.7075C41.2955 16.7075 42.712 17.2942 43.7564 18.3386C44.8008 19.383 45.3875 20.7995 45.3875 22.2765C45.3875 23.7536 44.8008 25.1701 43.7564 26.2145C42.712 27.2589 41.2955 27.8456 39.8184 27.8456C38.3414 27.8456 36.9249 27.2589 35.8805 26.2145C34.8361 25.1701 34.2494 23.7536 34.2494 22.2765ZM9.18848 22.2765C9.18848 20.7995 9.77522 19.383 10.8196 18.3386C11.864 17.2942 13.2805 16.7075 14.7576 16.7075C16.2346 16.7075 17.6511 17.2942 18.6955 18.3386C19.7399 19.383 20.3266 20.7995 20.3266 22.2765C20.3266 23.7536 19.7399 25.1701 18.6955 26.2145C17.6511 27.2589 16.2346 27.8456 14.7576 27.8456C13.2805 27.8456 11.864 27.2589 10.8196 26.2145C9.77522 25.1701 9.18848 23.7536 9.18848 22.2765ZM16.7253 32.2396C17.8576 30.465 19.419 29.0045 21.2653 27.9931C23.1115 26.9817 25.1829 26.4522 27.288 26.4534C29.0512 26.4517 30.7949 26.8225 32.4049 27.5415C34.0149 28.2604 35.4548 29.3113 36.6306 30.6253C37.8063 31.9393 38.6913 33.4868 39.2275 35.1665C39.7637 36.8462 39.9392 38.6202 39.7423 40.3724C39.7183 40.59 39.6432 40.799 39.5232 40.9822C39.4032 41.1654 39.2417 41.3177 39.0518 41.4268C35.4719 43.4809 31.4153 44.5589 27.288 44.5529C23.1606 44.5594 19.1039 43.4814 15.5242 41.4268C15.3343 41.3177 15.1728 41.1654 15.0528 40.9822C14.9328 40.799 14.8577 40.59 14.8337 40.3724C14.5219 37.5259 15.1891 34.6581 16.7253 32.2415V32.2396Z" fill="#328569"/>
          <path d="M14.4465 30.6368C12.6157 33.4629 11.7627 36.8117 12.0184 40.1693C10.9037 40.0003 9.80729 39.7268 8.74377 39.3525L8.53029 39.2782C8.33982 39.2106 8.17303 39.0892 8.05014 38.9288C7.92724 38.7683 7.85351 38.5757 7.83786 38.3742L7.8193 38.1495C7.74431 37.2176 7.85783 36.2801 8.15308 35.3929C8.44833 34.5058 8.91927 33.6872 9.53778 32.9861C10.1563 32.2849 10.9097 31.7155 11.7531 31.3119C12.5964 30.9083 13.5125 30.6787 14.4465 30.6368ZM42.5593 40.1693C42.815 36.8117 41.962 33.4629 40.1311 30.6368C41.0652 30.6787 41.9812 30.9083 42.8246 31.3119C43.6679 31.7155 44.4214 32.2849 45.0399 32.9861C45.6584 33.6872 46.1293 34.5058 46.4246 35.3929C46.7198 36.2801 46.8333 37.2176 46.7584 38.1495L46.7398 38.3742C46.7238 38.5753 46.6499 38.7676 46.527 38.9277C46.4042 39.0878 46.2376 39.2089 46.0474 39.2764L45.8339 39.3506C44.7813 39.7219 43.6879 39.9985 42.5593 40.1693Z" fill="#328569"/>
        </svg>
       <span>Groups</span></div>`
      }

      if (menuItemName === "Audit") {
        item.querySelector("a").innerHTML = `<div class="menu-item-container">
          <svg xmlns="http://www.w3.org/2000/svg" width="55" height="56" viewBox="0 0 55 56" fill="none">
            <path d="M25.179 0.74287C19.5121 1.30289 14.6587 3.18294 10.5119 6.42303C9.23186 7.42305 7.01847 9.62311 5.97844 10.9165C0.164944 18.21 -1.54177 27.9436 1.44498 36.7172C6.33845 51.0642 21.8589 58.6645 36.2326 53.7577C41.9928 51.7976 47.4062 47.4508 50.5663 42.2373C52.2997 39.3839 53.6331 35.8638 54.1664 32.7704C55.0731 27.5303 54.4731 22.1435 52.433 17.3567C48.4996 8.10307 39.7794 1.72956 29.7791 0.782871C28.3924 0.662868 26.219 0.6362 25.179 0.74287ZM29.6591 3.06293C39.566 4.02296 47.8862 10.6498 51.0463 20.1167C52.273 23.7835 52.633 28.4236 51.9797 32.1571C50.2863 41.784 43.1261 49.6509 33.8192 52.1043C31.8325 52.6243 30.9925 52.771 28.9524 52.9176C22.9789 53.3443 16.9387 51.5309 12.1253 47.8642C1.93833 40.1039 -0.728413 25.9036 5.9251 14.9433C7.84515 11.7698 10.8319 8.72976 13.912 6.82304C15.392 5.90301 17.6988 4.78298 19.0588 4.32964C20.3122 3.91629 20.8322 4.00963 21.1255 4.72964C21.4855 5.59634 21.1122 5.99635 19.3788 6.63636C13.9787 8.63642 9.5652 12.6099 6.97846 17.7833C4.37839 22.9968 3.84504 28.437 5.37842 34.0504C8.20516 44.4374 18.2454 51.5043 28.9391 50.6509C39.2327 49.8242 47.3796 42.664 49.6063 32.4771C49.873 31.2904 49.8996 30.7304 49.8996 27.9836C49.8996 25.2369 49.873 24.6769 49.6063 23.4902C48.0463 16.3566 43.4995 10.5031 37.126 7.44972C34.5392 6.22302 31.9258 5.543 28.6991 5.26299C26.659 5.08966 26.3523 4.96965 26.1923 4.30297C26.0857 3.87629 26.3523 3.30294 26.779 3.0896C27.1924 2.87626 27.779 2.87626 29.6591 3.06293ZM39.326 13.5299C40.0727 13.8766 40.9661 14.6632 41.4061 15.3566C42.1261 16.49 42.1261 16.5033 42.0861 28.3436L42.0461 39.2506L41.6061 40.1439C41.0994 41.1706 40.3794 41.8773 39.326 42.3707L38.5793 42.7174L27.659 42.7574C15.832 42.7974 15.8187 42.7974 14.6853 42.0773C13.992 41.6373 13.2053 40.744 12.8586 39.9973C12.5786 39.3839 12.5786 39.3039 12.5386 28.2636C12.4986 15.97 12.4719 16.3833 13.352 15.1033C13.592 14.7566 14.0853 14.2632 14.432 14.0232C15.6854 13.1699 15.1787 13.1965 27.5124 13.2232C38.646 13.2499 38.7127 13.2499 39.326 13.5299Z" />
            <path d="M16.1793 15.6359C15.686 15.8625 15.1126 16.4626 14.926 16.9559C14.846 17.1693 14.7793 18.3826 14.7793 19.796V22.2494H27.313H39.8466V19.8093C39.8466 17.7293 39.8066 17.3026 39.5933 16.8492C39.3133 16.2359 38.8733 15.7959 38.3399 15.5959C37.7266 15.3559 16.6993 15.4092 16.1793 15.6359ZM20.0594 18.0359C20.3394 18.2759 20.4328 18.4626 20.4328 18.8493C20.4328 19.236 20.3394 19.4226 20.0594 19.6627C19.7528 19.9427 19.5528 19.9827 18.7394 19.9827C17.7394 19.9693 17.4727 19.8627 17.206 19.356C16.9527 18.8893 17.0194 18.516 17.4327 18.1026C17.7927 17.7426 17.8994 17.7159 18.7661 17.7159C19.5528 17.7159 19.7528 17.7693 20.0594 18.0359ZM25.5663 17.9159C26.2196 18.2493 26.3263 19.116 25.7796 19.6493C25.4996 19.9427 25.3396 19.9827 24.4462 19.9827C23.5529 19.9827 23.3929 19.9427 23.1129 19.6493C22.5528 19.1026 22.6862 18.2493 23.3795 17.8759C23.7662 17.6626 25.1262 17.6893 25.5663 17.9159Z" />
            <path d="M14.7793 31.5703C14.7793 36.2504 14.8326 38.7572 14.926 39.0105C15.126 39.5439 15.566 39.9839 16.1793 40.2639C16.686 40.5039 17.286 40.5172 27.1796 40.5172C34.3798 40.5172 37.8066 40.4639 38.1799 40.3705C38.8466 40.1839 39.5133 39.5172 39.7 38.8505C39.7933 38.4905 39.8466 36.0104 39.8466 31.4103V24.5168H27.313H14.7793V31.5703ZM19.7794 26.9435C20.4728 27.2635 20.5128 27.4902 20.5128 31.917V35.9971L21.6195 35.9571L22.7128 35.9171L22.7795 33.9704C22.8329 32.3037 22.8862 31.9703 23.0995 31.7436C23.3929 31.4103 23.7795 31.3303 24.2862 31.4903C24.9129 31.6903 25.0462 32.157 25.0462 34.1837V35.9838H26.1796H27.313V32.317V28.6369L27.6463 28.3169C28.0063 27.9569 28.6997 27.8769 29.0597 28.1569C29.5397 28.5302 29.5797 28.8369 29.5797 32.437V35.9838H30.7131H31.8464V33.5837C31.8464 32.117 31.8998 31.077 31.9931 30.877C32.2464 30.3169 33.1398 30.0636 33.5931 30.4236C34.0465 30.7703 34.1132 31.1436 34.1132 33.5704V35.9838H34.9132C35.5932 35.9838 35.7799 36.0371 36.0465 36.3171C36.4732 36.7304 36.4732 37.3171 36.0599 37.8105L35.7399 38.1838H27.3396H18.9394L18.5927 37.8638L18.2461 37.5438V32.5303C18.2594 27.1702 18.2461 27.1969 18.9261 26.9302C19.3528 26.7568 19.3794 26.7568 19.7794 26.9435Z" />
          </svg>
         <span>Audit</span></div>`
      }
    });


    //go to home page and clear selected menu item
   /* try {
      document.querySelector(".logo-container").addEventListener("click", async () => {
        if (document.querySelector("webc-app-menu-item[active]")) {
          document.querySelector("webc-app-menu-item[active]").removeAttribute("active");
        }
        await navigateToPageTag("home", {skipLoginAudit: true});
      })
    } catch (e) {
      console.log("Menu not initialized yet.", e);
    }*/


  });

  define("dw-action");
  define("dw-subdomains");
  define("dw-dialog-configuration");
  define("dw-dialog-view-credential");
  define("dw-dialog-booting-identity");
  define("dw-dialog-add-domain");
  define("dw-dialog-waiting-approval");
  define("dw-dialog-initialising");
  define("dw-dialog-break-glass-recovery");
  define("dw-dialog-group-members-update");
}

if (userData) {
  //we finish the init only if proper user details retrieval was executed
  finishInit();
}
