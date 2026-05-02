/* V55 Routex walkthrough spread for duplicate review + spread saturation */
(function(){
  if(window.__ROUTEX_WHITEGLOVE_TOURS_V55__) return;
  window.__ROUTEX_WHITEGLOVE_TOURS_V55__ = true;
  function toast(msg){ try{ (window.toast || console.log)(msg); }catch(_){ } }
  function run(){
    const steps = [
      ()=> { toast('White-glove v55 walkthrough: opening the duplicate review + spread center.'); if(window.openWhiteGloveV55Center) window.openWhiteGloveV55Center(); },
      ()=> { toast('Step 2: build the duplicate review pack to find ambiguous premium booking chains.'); if(window.buildWhiteGloveDuplicateReviewV55) window.buildWhiteGloveDuplicateReviewV55(); },
      ()=> { toast('Step 3: keep ambiguous chains operator-reviewed or apply cancellation only where one primary booking is obvious.'); },
      ()=> { toast('Step 4: build the entrypoint spread so the newest hardening surfaces are reachable from more operator entry points.'); if(window.buildWhiteGloveEntrypointSpreadV55) window.buildWhiteGloveEntrypointSpreadV55(); },
      ()=> { toast('Step 5: use v54 collision resolution and v53 hardening after v55 to confirm the chain is stable.'); }
    ];
    steps.forEach((fn, i)=> setTimeout(fn, i * 900));
  }
  window.startWhiteGloveTourV55 = run;
})();
