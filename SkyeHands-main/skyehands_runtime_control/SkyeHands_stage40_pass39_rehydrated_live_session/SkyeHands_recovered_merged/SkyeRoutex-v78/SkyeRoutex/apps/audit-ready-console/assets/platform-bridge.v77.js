(function(){
  function init(){
    if(!window.RoutexSharedAppFabricV77 || !window.RoutexAuditReadyConsoleV77) return;
    try{ window.RoutexAuditReadyConsoleV77.renderShell(); }catch(_){}
    window.RoutexAuditReadyConsoleV77.platform = {
      refresh:function(){ return window.RoutexSharedAppFabricV77.refreshRegistry(); },
      autodiscover:function(){ return window.RoutexSharedAppFabricV77.autodiscoverEstate(); },
      autowire:function(){ return window.RoutexSharedAppFabricV77.autowireEstate(); },
      qa:function(){ return window.RoutexSharedAppFabricV77.runEstateQA(); },
      deadButtons:function(){ return window.RoutexSharedAppFabricV77.runDeadButtonAudit(); },
      certify:function(){ return window.RoutexSharedAppFabricV77.certifyEstate(); },
      scaffoldPlus:function(input){ return window.RoutexSharedAppFabricV77.scaffoldPlus(input); }
    };
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();