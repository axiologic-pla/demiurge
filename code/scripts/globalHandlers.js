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
        const time = 1500;
        setTimeout(()=>{
            console.info("The refresh procedure is currently executing...");
            try{
                window.top.location.reload();
                window.top.history.go(0);
                window.top.location.href = window.top.location.href;
            }catch(err){
                console.debug(`Failed to execute refresh because of `, err);
            }
        }, time);
        console.info(`The page refresh is scheduled to occur in ${time}ms.`);
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