/* V51 Routex walkthroughs for operator deck + merge/duplication surfaces */
(function(){
  if(window.__ROUTEX_WHITEGLOVE_TOURS_V51__) return;
  window.__ROUTEX_WHITEGLOVE_TOURS_V51__ = true;
  const wait = (ms)=> new Promise(resolve => setTimeout(resolve, ms));
  const esc = (v)=> String(v == null ? '' : v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  let overlay = null, activeTarget = null, activeTour = null;
  function clearTarget(){ if(activeTarget){ activeTarget.classList.remove('rtx-wg51-target'); activeTarget = null; } }
  function ensureStyle(){
    if(document.getElementById('routexWg51TourStyle')) return;
    const style = document.createElement('style');
    style.id = 'routexWg51TourStyle';
    style.textContent = '.rtx-wg51-target{position:relative !important; z-index:10012 !important; box-shadow:0 0 0 3px rgba(96,165,250,.95),0 0 0 9999px rgba(3,1,8,.56) !important; border-radius:16px !important;} .rtx-wg51-overlay{position:fixed; inset:0; z-index:10011; pointer-events:none;} .rtx-wg51-dock{position:fixed; right:18px; bottom:18px; width:min(420px,calc(100vw - 28px)); border:1px solid rgba(255,255,255,.16); border-radius:20px; background:linear-gradient(180deg, rgba(12,20,38,.96), rgba(7,12,25,.94)); box-shadow:0 28px 80px rgba(0,0,0,.52); padding:16px; color:#fff; pointer-events:auto;}';
    document.head.appendChild(style);
  }
  function ensureOverlay(){
    ensureStyle();
    if(overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'rtx-wg51-overlay hidden';
    overlay.innerHTML = '<div class="rtx-wg51-dock"><div id="rtxWg51Meta" class="pill">Step 1 / 1</div><h3 id="rtxWg51Title" style="margin:8px 0 6px;font:700 18px system-ui"></h3><div id="rtxWg51Body" style="font:13px system-ui;line-height:1.55;color:rgba(255,255,255,.84)"></div><div style="height:7px;border-radius:999px;background:rgba(255,255,255,.10);overflow:hidden;margin:14px 0 12px"><i id="rtxWg51Bar" style="display:block;height:100%;width:0;background:linear-gradient(90deg,#60a5fa,#c084fc)"></i></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button id="rtxWg51Back" type="button">Back</button><button id="rtxWg51Next" type="button">Next</button><div style="flex:1"></div><button id="rtxWg51Close" type="button">Close</button></div></div>';
    document.body.appendChild(overlay);
    document.getElementById('rtxWg51Back').onclick = ()=> move(-1);
    document.getElementById('rtxWg51Next').onclick = ()=> move(1);
    document.getElementById('rtxWg51Close').onclick = ()=> closeTour();
    return overlay;
  }
  async function gotoView(viewId){ if(window.APP && APP.view !== viewId){ APP.view = viewId; try{ window.location.hash = viewId; }catch(_){} if(typeof window.render === 'function') await window.render(); await wait(180); } }
  async function resolveTarget(step){
    if(typeof step.getTarget === 'function') return await step.getTarget();
    for(let i=0;i<10;i++){ const node = document.querySelector(step.selector); if(node) return node; await wait(90); }
    return null;
  }
  async function applyStep(){
    if(!activeTour) return;
    const step = activeTour.steps[activeTour.index];
    if(step.view) await gotoView(step.view);
    if(typeof step.before === 'function') await step.before();
    clearTarget();
    const target = await resolveTarget(step);
    if(target){ activeTarget = target; target.classList.add('rtx-wg51-target'); target.scrollIntoView?.({ behavior:'smooth', block:'center', inline:'center' }); }
    ensureOverlay(); overlay.classList.remove('hidden');
    document.getElementById('rtxWg51Meta').textContent = 'Step ' + (activeTour.index + 1) + ' / ' + activeTour.steps.length;
    document.getElementById('rtxWg51Title').textContent = step.title;
    document.getElementById('rtxWg51Body').textContent = step.body;
    document.getElementById('rtxWg51Bar').style.width = (((activeTour.index + 1) / activeTour.steps.length) * 100).toFixed(1) + '%';
    document.getElementById('rtxWg51Back').disabled = activeTour.index === 0;
    document.getElementById('rtxWg51Next').textContent = activeTour.index === activeTour.steps.length - 1 ? 'Finish' : 'Next';
  }
  async function move(delta){
    if(!activeTour) return;
    const next = activeTour.index + delta;
    if(next < 0) return;
    if(next >= activeTour.steps.length){ closeTour(); return; }
    activeTour.index = next; await applyStep();
  }
  function closeTour(){ clearTarget(); if(overlay) overlay.classList.add('hidden'); activeTour = null; }
  const tours = {
    deck: [
      { view:'dashboard', selector:'#wg-v51-launcher', title:'Open the unified operator deck', body:'This walkthrough opens the live deck surface that combines finance, continuity, backend, conflict, and restore signals.', before: async()=>{ await wait(120); } },
      { view:'dashboard', before: async()=>{ if(typeof window.openWhiteGloveOperatorDeckV51 === 'function') window.openWhiteGloveOperatorDeckV51(); await wait(180); }, selector:'#wg-v51-save-deck', title:'Save deck snapshot', body:'The deck snapshot gives the operator one stored command view instead of scattered white-glove cards.' },
      { view:'dashboard', before: async()=>{ if(typeof window.openWhiteGloveOperatorDeckV51 === 'function') window.openWhiteGloveOperatorDeckV51(); await wait(180); }, selector:'#wg-v51-deck', title:'Inspect live deck payload', body:'The live deck payload exposes totals, economics, continuity, risk, and top actions from the actual stored white-glove chain.' }
    ],
    merge: [
      { view:'dashboard', before: async()=>{ if(typeof window.openWhiteGloveOperatorDeckV51 === 'function') window.openWhiteGloveOperatorDeckV51(); await wait(180); }, selector:'#wg-v51-booking', title:'Choose a booking for duplication', body:'Route duplication is now a first-class operator surface for repeat, return-leg rebuild, and multi-stop splitting.' },
      { view:'dashboard', before: async()=>{ if(typeof window.openWhiteGloveOperatorDeckV51 === 'function') window.openWhiteGloveOperatorDeckV51(); await wait(180); }, selector:'#wg-v51-preview-duplicate', title:'Preview the duplicate chain', body:'Preview shows what the clone or split chain will look like before the app commits it into the white-glove booking and route stores.' },
      { view:'dashboard', before: async()=>{ if(typeof window.openWhiteGloveOperatorDeckV51 === 'function') window.openWhiteGloveOperatorDeckV51(); await wait(180); }, selector:'#wg-v51-merge-policy', title:'Choose merge policy', body:'Merge hardening lets the operator preview whether newer rows replace older ones, whether existing rows win, or whether incoming stores replace local state.' },
      { view:'dashboard', before: async()=>{ if(typeof window.openWhiteGloveOperatorDeckV51 === 'function') window.openWhiteGloveOperatorDeckV51(); await wait(180); }, selector:'#wg-v51-preview-merge', title:'Preview merge risks', body:'Preview now exposes stale incoming rows and missing booking-link references before the operator applies a restore or merge run.' }
    ]
  };
  window.startRoutexWhiteGloveV51Tour = function(kind){ const steps = tours[kind] || tours.deck; activeTour = { index:0, steps }; applyStep(); };
})();
