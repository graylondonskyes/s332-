/* V52 Routex walkthroughs for valuation center + backend chain visibility */
(function(){
  if(window.__ROUTEX_WHITEGLOVE_TOURS_V52__) return;
  window.__ROUTEX_WHITEGLOVE_TOURS_V52__ = true;
  const wait = (ms)=> new Promise(r => setTimeout(r, ms));
  let overlay = null, activeTour = null, activeTarget = null;
  function clearTarget(){ if(activeTarget){ activeTarget.classList.remove('tour-active-target'); activeTarget = null; } }
  function ensureOverlay(){
    if(overlay) return overlay;
    const style = document.createElement('style');
    style.textContent = '.tour-active-target{outline:3px solid #9f6bff!important;box-shadow:0 0 0 6px rgba(159,107,255,.18)!important;border-radius:14px!important}.wg52-tour-overlay{position:fixed;inset:0;z-index:100100;pointer-events:none}.wg52-tour-dock{position:fixed;right:22px;bottom:22px;max-width:420px;background:#12081f;color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:22px;padding:16px;box-shadow:0 22px 50px rgba(0,0,0,.4);pointer-events:auto}.wg52-tour-title{font:800 19px system-ui;margin:0 0 6px}.wg52-tour-body{font:13px/1.55 system-ui;color:rgba(255,255,255,.82);white-space:pre-wrap}.wg52-tour-progress{height:7px;border-radius:999px;background:rgba(255,255,255,.1);overflow:hidden;margin:14px 0}.wg52-tour-progress>i{display:block;height:100%;width:0;background:linear-gradient(90deg,#f5c542,#9f6bff)}';
    document.head.appendChild(style);
    overlay = document.createElement('div'); overlay.className='wg52-tour-overlay hidden';
    overlay.innerHTML = '<div class="wg52-tour-dock"><div id="wg52Meta" class="pill">Step 1 / 1</div><h3 id="wg52Title" class="wg52-tour-title">White-glove guide</h3><div id="wg52Body" class="wg52-tour-body"></div><div class="wg52-tour-progress"><i id="wg52Bar"></i></div><div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn small" id="wg52Back">Back</button><button class="btn small" id="wg52Next">Next</button><div class="spacer"></div><button class="btn small danger" id="wg52Close">Close</button></div></div>';
    document.body.appendChild(overlay);
    overlay.querySelector('#wg52Back').onclick = ()=> step(-1);
    overlay.querySelector('#wg52Next').onclick = ()=> step(1);
    overlay.querySelector('#wg52Close').onclick = close;
    return overlay;
  }
  function tours(){ return {
    value:[
      { before: async()=>{ if(typeof window.openWhiteGloveValuationCenterV52 === 'function') window.openWhiteGloveValuationCenterV52(); await wait(220); }, selector:'#wg-v52-val', title:'2026 valuation center', body:'This guide lands on the live valuation center. Users can inspect the stored 2026 valuation snapshot, see what drives the number, and open the PDF or HTML summary.' },
      { before: async()=>{ if(typeof window.openWhiteGloveValuationCenterV52 === 'function') window.openWhiteGloveValuationCenterV52(); await wait(220); }, selector:'#wg-v52-open-pdf', title:'Open the client-facing PDF', body:'The app exposes the valuation PDF directly. This is not hidden operator-only paperwork; it is meant to be visible and easy to reach.' },
      { before: async()=>{ if(typeof window.openWhiteGloveValuationCenterV52 === 'function') window.openWhiteGloveValuationCenterV52(); await wait(220); }, selector:'#wg-v52-super', title:'Unified superdeck', body:'The superdeck combines commercial value, operational readiness, conflict risk, and booking-chain proof in one exportable surface.' }
    ],
    backend:[
      { before: async()=>{ if(typeof window.openWhiteGloveBackendCommandV50 === 'function') window.openWhiteGloveBackendCommandV50(); await wait(220); }, selector:'#wg-v50-snapshot', title:'Backend snapshot', body:'This walkthrough lands on the live backend visibility lane that tracks contract-side state for bookings, sync, and merge control.' },
      { before: async()=>{ if(typeof window.openWhiteGloveValuationCenterV52 === 'function') window.openWhiteGloveValuationCenterV52(); await wait(220); }, selector:'#wg-v52-audit', title:'Booking-chain audit', body:'Complex white-glove runs need a chain audit. This pass checks the canonical record family for profile, membership, route, docs, execution, payout, and conflict linkage.' },
      { before: async()=>{ if(typeof window.openWhiteGloveOperatorDeckV51 === 'function') window.openWhiteGloveOperatorDeckV51(); await wait(220); }, selector:'#wg-v51-merge', title:'Merge policy hardening', body:'The product now teaches merge-policy previews on the real screen so restore and portability controls are not mysterious.' }
    ],
    settings:[
      { view:'settings', selector:'#routexWg52SettingsCard', title:'Settings-side valuation access', body:'Users can find the valuation center and PDF in Settings too, so the trust layer stays visible after onboarding.' },
      { view:'settings', selector:'#routexWg52SettingsGuide', title:'Run the deep-surface guide', body:'This button launches a guided pass for the newest backend, chain-audit, and value surfaces.' }
    ]
  }; }
  function switchView(name){ try{ if(window.APP && APP.view !== name && typeof window.switchTab === 'function') window.switchTab(name); }catch(_){} }
  async function apply(){ if(!activeTour) return; const steps = tours()[activeTour.kind] || []; const step = steps[activeTour.index]; if(!step) return; ensureOverlay(); if(step.view) switchView(step.view); if(typeof step.before === 'function') await step.before(); clearTarget(); const target = step.selector ? document.querySelector(step.selector) : null; if(target){ activeTarget = target; activeTarget.classList.add('tour-active-target'); activeTarget.scrollIntoView({ behavior:'smooth', block:'center' }); }
    overlay.style.display='block'; overlay.querySelector('#wg52Meta').textContent = 'Step ' + (activeTour.index + 1) + ' / ' + steps.length; overlay.querySelector('#wg52Title').textContent = step.title || 'White-glove guide'; overlay.querySelector('#wg52Body').textContent = step.body || ''; overlay.querySelector('#wg52Bar').style.width = (((activeTour.index + 1) / steps.length) * 100).toFixed(1) + '%'; overlay.querySelector('#wg52Next').textContent = activeTour.index === steps.length - 1 ? 'Finish' : 'Next'; }
  async function step(delta){ const steps = tours()[activeTour.kind] || []; const next = activeTour.index + delta; if(next < 0) return; if(next >= steps.length){ close(); return; } activeTour.index = next; await apply(); }
  function close(){ clearTarget(); if(overlay) overlay.style.display='none'; activeTour = null; }
  window.startRoutexWhiteGloveV52Tour = function(kind){ activeTour = { kind: kind || 'value', index: 0 }; apply(); };
})();
