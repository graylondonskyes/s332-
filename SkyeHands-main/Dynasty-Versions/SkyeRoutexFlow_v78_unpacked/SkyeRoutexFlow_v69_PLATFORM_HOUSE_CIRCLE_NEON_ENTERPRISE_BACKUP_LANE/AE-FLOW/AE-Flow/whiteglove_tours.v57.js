
/* V57 AE FLOW client transparency guide */
(function(){
  if(window.__AEFLOW_WHITEGLOVE_TOURS_V57__) return;
  window.__AEFLOW_WHITEGLOVE_TOURS_V57__ = true;
  window.startAEFlowWhiteGloveTourV57 = function(){
    try{ const msg = 'AE FLOW V57 guide\n\n1. Open WG Client Sync.\n2. Sync the latest client transparency packet from Routex.\n3. Sync the latest member statement if a rider is on a plan.\n4. Use these inboxes as outward-facing continuity visibility rather than raw backend records.'; if(window.toast) window.toast(msg); else alert(msg); }catch(_){}
    if(window.openWhiteGloveV57Visibility) window.openWhiteGloveV57Visibility();
  };
})();
