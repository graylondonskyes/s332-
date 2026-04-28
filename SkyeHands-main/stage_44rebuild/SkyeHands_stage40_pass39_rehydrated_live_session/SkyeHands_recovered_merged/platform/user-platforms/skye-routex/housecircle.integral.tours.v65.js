(function(){
  if(window.__ROUTEX_HOUSECIRCLE_TOURS_V65__) return;
  window.__ROUTEX_HOUSECIRCLE_TOURS_V65__ = true;
  var clean = window.cleanStr || function(v){ return String(v == null ? '' : v).trim(); };
  var toastFn = (typeof toast === 'function') ? toast : function(){};
  window.RoutexPlatformHouseCircleToursV65 = {
    runSecurityWalkthrough: function(){
      toastFn(clean('V65 security lane: enroll MFA, trust this device, lock the route, then refresh the event feed.'), 'ok');
      if(window.RoutexPlatformHouseCircleV65 && typeof window.RoutexPlatformHouseCircleV65.openMfaOpsModal === 'function'){
        window.RoutexPlatformHouseCircleV65.openMfaOpsModal();
      }
    }
  };
})();
