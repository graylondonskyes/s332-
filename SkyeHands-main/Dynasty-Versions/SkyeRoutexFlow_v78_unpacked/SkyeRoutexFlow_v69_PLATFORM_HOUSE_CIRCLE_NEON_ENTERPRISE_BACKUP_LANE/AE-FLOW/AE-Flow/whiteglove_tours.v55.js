/* V55 AE FLOW walkthrough for duplicate review + spread visibility */
(function(){
  if(window.__AEFLOW_WHITEGLOVE_TOURS_V55__) return;
  window.__AEFLOW_WHITEGLOVE_TOURS_V55__ = true;
  function toast(msg){ try{ (window.toast || console.log)(msg); }catch(_){ } }
  window.startAEWhiteGloveTourV55 = function(){
    const steps = [
      ()=> { toast('AE FLOW v55 walkthrough: opening the duplicate review and spread inbox.'); if(window.openAEWhiteGloveV55Center) window.openAEWhiteGloveV55Center(); },
      ()=> { toast('Step 2: sync the latest Routex duplicate review pack so operators can see ambiguous booking chains.'); if(window.syncWhiteGloveDuplicateReviewInboxV55) window.syncWhiteGloveDuplicateReviewInboxV55(); },
      ()=> { toast('Step 3: sync the entrypoint spread report to confirm the newest hardening surfaces are reachable.'); if(window.syncWhiteGloveSpreadInboxV55) window.syncWhiteGloveSpreadInboxV55(); },
      ()=> { toast('Step 4: use this inbox as the operator-facing proof that Routex handled review-only duplicate cases deliberately.'); }
    ];
    steps.forEach((fn, i)=> setTimeout(fn, i * 900));
  };
})();
