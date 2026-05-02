
/* V57 Routex white-glove client transparency guide */
(function(){
  if(window.__ROUTEX_WHITEGLOVE_TOURS_V57__) return;
  window.__ROUTEX_WHITEGLOVE_TOURS_V57__ = true;
  const steps = [
    { label:'Open the white-glove client transparency center from the floating WG Client Pack button.' },
    { label:'Build a client packet so the booking chain can be shown in one outward-facing view.' },
    { label:'Export HTML for a client-facing packet or JSON for operator/audit transfer.' },
    { label:'Build a member statement when the booking is tied to an included-hours or miles plan.' },
    { label:'Use the v56 center and superdeck together if you need deeper hardening/proof context before sharing outwardly.' }
  ];
  window.startWhiteGloveTourV57 = function(){
    try{ const msg = 'V57 guide\n\n' + steps.map((s, i)=> (i+1) + '. ' + s.label).join('\n'); if(window.toast) window.toast(msg); else alert(msg); }catch(_){ }
    if(window.openWhiteGloveV57Center) window.openWhiteGloveV57Center();
  };
})();
