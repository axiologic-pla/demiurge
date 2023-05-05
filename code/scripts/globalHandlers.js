/*document.body.onbeforeunload = ()=>{
    if(window.disableRefreshSafetyAlert){
        return ;
    }
    return "Are you sure? This may cause inconsistencies";
}*/

if ($$) {
    $$.refreshInProgress = false;
    $$.showErrorAlert = (text)=>{
        if(!$$.refreshInProgress){
            alert(text);
        }
    }

    $$.forceTabRefresh = ()=>{
        $$.refreshInProgress = true;
        setTimeout(()=>{
            window.top.location.reload();
        }, 1500);
        console.warn("Refreshing...");
    }

    $$.navigateToPage = (page)=>{
        $$.refreshInProgress = true;
        setTimeout(()=>{
            $$.history.go(page);
        }, 1500);
        console.warn("Navigating to a new page...");
    }

    $$.forceRedirect = (url)=>{
        $$.refreshInProgress = true;
        setTimeout(()=>{
            window.top.location.replace(url);
        }, 1500);
        console.warn("Redirecting...");
    }

    $$.disableAlerts = ()=>{
        $$.refreshInProgres = true;
    }

    const originalHTTPHandler = $$.httpUnknownResponseGlobalHandler;
    $$.httpUnknownResponseGlobalHandler = function (res) {
        let err = res ? res.err : undefined;
        if (err && err.rootCause == "network") {
            originalHTTPHandler(res);
            $$.showErrorAlert("Network issues detected!");
        }
    }

    $$.disableBrowserConfirm = function(){
        $$.confirmDisabled = true;
    }

    $$.enableBrowserConfirm = function(){
        $$.confirmDisabled = false;
    };

    $$.hookConfirm = function(){
        let confirm = window.confirm;
        window.confirm = function(message){
            if($$.confirmDisabled){
                return true;
            }
            return confirm.call(window, message);
        }
    }

    $$.hookConfirm();
}