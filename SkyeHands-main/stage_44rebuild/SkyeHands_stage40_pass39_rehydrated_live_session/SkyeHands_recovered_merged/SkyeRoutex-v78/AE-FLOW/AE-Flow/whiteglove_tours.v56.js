
/* V56 AE FLOW walkthrough for conservative duplicate review + saturation */
(function(){
  if(window.__AEFLOW_WHITEGLOVE_TOURS_V56__) return;
  window.__AEFLOW_WHITEGLOVE_TOURS_V56__ = true;
  function toast(msg){ try{ (window.toast || console.log)(msg); }catch(_){ } }
  function run(){
    const steps = [
      ()=> { toast('White-glove v56 walkthrough: opening the final conservative hardening center.'); if(window.openWhiteGloveV56Visibility) window.openWhiteGloveV56Visibility(); },
      ()=> { toast('Step 2: build the guardrail pack so ambiguous duplicate premium bookings stay review-only.'); if(window.syncWhiteGloveGuardrailInboxV56) window.syncWhiteGloveGuardrailInboxV56(); },
      ()=> { toast('Step 3: apply the safe plan only for auto-eligible groups, leaving review-only groups untouched.'); },
      ()=> { toast('Step 4: build the saturation spread so the newest hardening surfaces reach more entry points.'); if(window.syncWhiteGloveSaturationInboxV56) window.syncWhiteGloveSaturationInboxV56(); },
      ()=> { toast('Step 5: verify AE FLOW can import both guardrail and saturation outputs for operator visibility.'); }
    ];
    steps.forEach((fn, i)=> setTimeout(fn, i * 900));
  }
  window.startWhiteGloveTourV56 = run;
})();
