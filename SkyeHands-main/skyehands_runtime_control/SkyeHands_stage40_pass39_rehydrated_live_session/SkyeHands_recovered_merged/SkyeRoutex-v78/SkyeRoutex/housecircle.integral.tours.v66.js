(function(){
  if(window.__ROUTEX_HOUSECIRCLE_TOURS_V66__) return;
  window.__ROUTEX_HOUSECIRCLE_TOURS_V66__ = true;
  var toastFn = typeof toast === 'function' ? toast : function(){};
  window.RoutexPlatformHouseCircleToursV66 = {
    runValuationWalkthrough: function(){
      toastFn('V66 valuation lane: open the investor center, export the report, then push the valuation record to the cloud lane so it is discoverable when live.', 'ok');
      if(window.RoutexPlatformHouseCircleV66 && typeof window.RoutexPlatformHouseCircleV66.openValuationModal === 'function') window.RoutexPlatformHouseCircleV66.openValuationModal();
    }
  };
})();
