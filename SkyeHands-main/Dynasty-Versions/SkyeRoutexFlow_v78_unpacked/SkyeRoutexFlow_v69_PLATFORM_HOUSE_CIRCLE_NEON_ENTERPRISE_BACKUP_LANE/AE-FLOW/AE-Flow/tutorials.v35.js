
/* V36 AE FLOW interactive walkthrough system */
(function(){
  if(window.__AEFLOW_V36_TOURS__) return;
  window.__AEFLOW_V36_TOURS__ = true;

  const PROGRESS_KEY = 'skye_aeflow_tutorial_progress_v2';
  const ONBOARDING_KEY = 'skye_aeflow_tutorial_onboarding_v1';

  const clean = (v)=> String(v == null ? '' : v).trim();
  const esc = (v)=> String(v == null ? '' : v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const toast = window.toast || function(){};
  const wait = (ms)=> new Promise(resolve => setTimeout(resolve, ms));

  let overlay = null;
  let activeTour = null;
  let activeTarget = null;
  let onboardingPrompted = false;

  function readJSON(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    }catch(_){
      return fallback;
    }
  }
  function writeJSON(key, value){
    try{ localStorage.setItem(key, JSON.stringify(value)); }catch(_){}
    return value;
  }
  function readProgress(){ return readJSON(PROGRESS_KEY, {}); }
  function saveProgress(next){ return writeJSON(PROGRESS_KEY, next || {}); }
  function readOnboarding(){ return readJSON(ONBOARDING_KEY, { startedAt:'', dismissedAt:'', completedAt:'' }); }
  function saveOnboarding(patch){ return writeJSON(ONBOARDING_KEY, Object.assign({}, readOnboarding(), patch || {})); }

  function markProgress(id, patch){
    const next = readProgress();
    next[id] = Object.assign({}, next[id] || {}, patch || {}, { updatedAt: new Date().toISOString() });
    saveProgress(next);
    return next[id];
  }
  function completedCount(){
    const p = readProgress();
    return getTours().filter(t => p[t.id] && p[t.id].completedAt).length;
  }

  function ensureStyle(){
    if(document.getElementById('aeFlowTourStylesV36')) return;
    const style = document.createElement('style');
    style.id = 'aeFlowTourStylesV36';
    style.textContent = `
      .ae-tour-target{
        position: relative !important;
        z-index: 10002 !important;
        box-shadow: 0 0 0 3px rgba(245,197,66,.92), 0 0 0 9999px rgba(5,0,10,.56) !important;
        border-radius: 16px !important;
      }
      .ae-tour-overlay{ position: fixed; inset: 0; z-index: 10001; pointer-events: none; }
      .ae-tour-dock{
        position: fixed; right: 16px; bottom: 96px; width: min(420px, calc(100vw - 24px));
        border:1px solid rgba(255,255,255,.14); border-radius: 20px;
        background: linear-gradient(180deg, rgba(25,8,45,.96), rgba(10,4,20,.94));
        box-shadow: 0 26px 80px rgba(0,0,0,.48); padding: 16px; color: rgba(255,255,255,.94); pointer-events: auto;
      }
      .ae-tour-title{ margin:0 0 8px; font-size:18px; font-weight:900; }
      .ae-tour-body{ font-size:13px; line-height:1.5; color:rgba(255,255,255,.8); white-space:pre-wrap; }
      .ae-tour-progress{ height:7px; border-radius:999px; background:rgba(255,255,255,.1); overflow:hidden; margin:14px 0 12px; }
      .ae-tour-progress > i{ display:block; height:100%; width:0; background:linear-gradient(90deg, rgba(245,197,66,.95), rgba(124,58,237,.92)); }
      .ae-tour-grid{ display:grid; grid-template-columns: repeat(auto-fit, minmax(210px,1fr)); gap:10px; margin-top:12px; }
      .ae-tour-tile{ border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.04); border-radius:16px; padding:12px; }
      .ae-tour-tile h4{ margin:0 0 6px; font-size:14px; }
      .ae-tour-tile p{ margin:0 0 10px; font-size:12px; line-height:1.45; color:rgba(255,255,255,.72); }
      .ae-tour-mini{ font-size:11px; color:rgba(255,255,255,.62); }
      .ae-tour-coverage{ width:100%; border-collapse:collapse; margin-top:12px; }
      .ae-tour-coverage th, .ae-tour-coverage td{ padding:8px; border-bottom:1px solid rgba(255,255,255,.08); text-align:left; vertical-align:top; font-size:12px; }
      .ae-help-launch{ margin-left:8px; }
      .ae-tour-launchpad{ margin-top:12px; }
    `;
    document.head.appendChild(style);
  }

  function ensureOverlay(){
    ensureStyle();
    if(overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'ae-tour-overlay hidden';
    overlay.id = 'aeFlowTourOverlay';
    overlay.innerHTML = `
      <div class="ae-tour-dock">
        <div class="pill" id="aeFlowTourMeta">Step 1 / 1</div>
        <h3 class="ae-tour-title" id="aeFlowTourTitle">AE FLOW walkthrough</h3>
        <div class="ae-tour-body" id="aeFlowTourBody"></div>
        <div class="ae-tour-progress"><i id="aeFlowTourBar"></i></div>
        <div class="row" style="flex-wrap:wrap;">
          <button class="btn small" id="aeFlowTourBackBtn" type="button">Back</button>
          <button class="btn small" id="aeFlowTourNextBtn" type="button">Next</button>
          <div class="spacer"></div>
          <button class="btn small" id="aeFlowTourHubBtn" type="button">Tour center</button>
          <button class="btn small danger" id="aeFlowTourCloseBtn" type="button">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('aeFlowTourBackBtn').onclick = ()=> moveStep(-1);
    document.getElementById('aeFlowTourNextBtn').onclick = ()=> moveStep(1);
    document.getElementById('aeFlowTourCloseBtn').onclick = ()=> closeTour();
    document.getElementById('aeFlowTourHubBtn').onclick = ()=> openCenter();
    return overlay;
  }

  function getTours(){
    return [
      {
        id:'aeflow-start-here',
        title:'Start here • Core AE FLOW',
        description:'Moves through intake, accounts, deals, and settings so a new user sees the actual operating surfaces.',
        covers:['intake','accounts','deals','settings'],
        steps:[
          { tab:'intake', title:'Intake workspace', body:'This is the lead-capture and entry lane where the AE records visit, contact, action, and note detail.' },
          { tab:'accounts', title:'Owned accounts', body:'Accounts turns captured businesses into owned working records for filtering, review, and routing.' },
          { tab:'deals', title:'Deals and proposals', body:'Deals is the money lane for presets, quotes, close logic, and structured follow-through.' },
          { tab:'settings', title:'Settings and backup', body:'Settings controls presets, brand defaults, exports, and the built-in tutorial center.' }
        ]
      },
      {
        id:'aeflow-accounts-to-routex',
        title:'Accounts to Routex',
        description:'Shows how AE FLOW becomes a feeder system for Routex instead of staying a disconnected CRM lane.',
        covers:['accounts','routex-queue','routex-seeds','routex-bridge'],
        steps:[
          { tab:'accounts', title:'Accounts are route-ready', body:'The accounts tab is the bridge surface where AE FLOW prepares visible businesses for Routex.' },
          { tab:'accounts', selector:'#aeRoutexQueueVisible', title:'Queue visible accounts', body:'This is the fastest way to hand the current visible account slice over to Routex.' },
          { tab:'accounts', selector:'#aeRoutexSaveSeed', title:'Save a Routex seed', body:'Seeds turn visible account slices into reusable handoff units.' },
          { tab:'accounts', selector:'#aeRoutexExportSeed', title:'Export seed', body:'The export side makes the bridge portable and reviewable.' }
        ]
      },
      {
        id:'aeflow-proof-and-proposals',
        title:'Proof, proposals, and view actions',
        description:'Covers proof exports, deal-side actions, and record-level operating controls.',
        covers:['record-actions','proof-export','proposals'],
        steps:[
          { tab:'accounts', selector:'#aeRoutexViewSave', title:'Record save controls', body:'These view actions are the per-record operating controls for the current AE lane.' },
          { tab:'accounts', selector:'#aeRoutexViewProof', title:'View proof', body:'Proof is visible from inside the record workflow, not only from Routex.' },
          { tab:'accounts', selector:'#aeRoutexViewProofExport', title:'Proof export', body:'This control shows how AE FLOW participates in proof-safe handoff behavior.' },
          { tab:'deals', title:'Deals still matter', body:'The deals lane stays part of the education pass so operators understand how outreach becomes structured value.' }
        ]
      },
      {
        id:'aeflow-bridge-sync-inboxes',
        title:'Bridge sync and inboxes',
        description:'Dedicated pass for imported Routex artifacts, sync buttons, and bridge transparency.',
        covers:['sync-buttons','launch-board-inbox','handoff-inbox','ops-brief-inbox','binder-inbox'],
        steps:[
          { tab:'accounts', selector:'#aeRoutexLaunchBoardSyncBtn', title:'Launch board sync', body:'AE FLOW can import the Routex operator launch board so readiness stays visible across the bridge.' },
          { tab:'accounts', selector:'#aeRoutexOpsBriefSyncBtn', title:'Ops brief sync', body:'This pulls the Routex operator command brief into AE FLOW for shared review.' },
          { tab:'accounts', selector:'#aeRoutexHandoffPacketSyncBtn', title:'Handoff packet sync', body:'Handoff packets move Routex closeout state into AE FLOW.' },
          { tab:'accounts', selector:'#aeRoutexCompletionBinderSyncBtn', title:'Completion binder sync', body:'Completion binders keep the final no-dead closeout artifact visible on the AE side too.' },
          { tab:'accounts', selector:'#aeRoutexWalkthroughReceiptSyncBtn', title:'Walkthrough receipt sync', body:'Walkthrough receipts show that the human guidance lane is part of the shared transparency stack.' }
        ]
      },
      {
        id:'aeflow-lineage-and-transfer',
        title:'Lineage, transfer, and attestation',
        description:'Covers legacy sync, transfer compare, no-dead compare, capsules, and device attestations.',
        covers:['legacy-sync','transfer-compare','no-dead-compare','capsules','attestation'],
        steps:[
          { tab:'accounts', selector:'#aeRoutexLegacySyncBtn', title:'Legacy sync', body:'Legacy intake and compare artifacts can be imported into AE FLOW for shared visibility.' },
          { tab:'accounts', selector:'#aeRoutexTransferSyncBtn', title:'Transfer proof sync', body:'Transfer-proof packages keep export/import confidence visible across the app bridge.' },
          { tab:'accounts', selector:'#aeRoutexNoDeadSyncBtn', title:'No-dead proof sync', body:'No-dead proof is a shared confidence surface, not just a Routex-only story.' },
          { tab:'accounts', selector:'#aeRoutexCapsuleSyncBtn', title:'Capsule sync', body:'Capsules are portable proof and transfer units for the shared app ecosystem.' },
          { tab:'accounts', selector:'#aeRoutexAttestSyncBtn', title:'Device attestation sync', body:'Attestations make device-level proof visible in the bridge.' }
        ]
      },
      {
        id:'aeflow-settings-and-tutorials',
        title:'Settings, backup, and tutorials',
        description:'Focused pass through settings so the user understands what is configurable, what exports, and where the built-in training lives.',
        covers:['settings','backup','tutorial-center'],
        steps:[
          { tab:'settings', selector:'#saveSettingsBtn', title:'Save settings', body:'Settings save deposit presets, brand text, and local operator defaults.' },
          { tab:'settings', selector:'#resetSettingsBtn', title:'Reset settings', body:'Reset is part of recovery and testing, so it is taught directly.' },
          { tab:'settings', title:'Built-in tutorial center', body:'AE FLOW now teaches itself in-product with interactive walkthroughs and a coverage matrix instead of detached notes.' }
        ]
      }
    ];
  }

  function getCoverageItems(){
    return [
      { id:'intake', label:'Intake workspace', tours:['aeflow-start-here'] },
      { id:'accounts', label:'Accounts and owned records', tours:['aeflow-start-here','aeflow-accounts-to-routex'] },
      { id:'deals', label:'Deals and proposals', tours:['aeflow-start-here','aeflow-proof-and-proposals'] },
      { id:'routex-queue', label:'Routex queue and seed flow', tours:['aeflow-accounts-to-routex'] },
      { id:'proof-export', label:'Proof and record exports', tours:['aeflow-proof-and-proposals'] },
      { id:'sync-buttons', label:'Routex sync buttons and inboxes', tours:['aeflow-bridge-sync-inboxes'] },
      { id:'legacy-sync', label:'Legacy and lineage sync', tours:['aeflow-lineage-and-transfer'] },
      { id:'transfer-compare', label:'Transfer and no-dead compare', tours:['aeflow-lineage-and-transfer'] },
      { id:'attestation', label:'Device attestation bridge', tours:['aeflow-lineage-and-transfer'] },
      { id:'settings', label:'Settings and backup', tours:['aeflow-start-here','aeflow-settings-and-tutorials'] },
      { id:'tutorial-center', label:'Built-in tutorial center', tours:['aeflow-settings-and-tutorials'] }
    ];
  }

  function getTour(id){ return getTours().find(t => t.id === id) || null; }

  function recommendedTourIds(){
    const p = readProgress();
    const ids = [];
    ['aeflow-start-here','aeflow-accounts-to-routex','aeflow-proof-and-proposals','aeflow-bridge-sync-inboxes','aeflow-lineage-and-transfer','aeflow-settings-and-tutorials'].forEach(id => {
      if(!(p[id] && p[id].completedAt)) ids.push(id);
    });
    return ids.length ? ids : getTours().map(t => t.id);
  }

  function clearTarget(){
    if(activeTarget){
      activeTarget.classList.remove('ae-tour-target');
      activeTarget = null;
    }
  }

  async function switchToTab(tab){
    if(typeof window.switchTab === 'function'){
      window.switchTab(tab);
      await wait(180);
    }
  }

  async function resolveTarget(step){
    if(typeof step.getTarget === 'function'){
      try{ return await step.getTarget(); }catch(_){ return null; }
    }
    if(!step.selector) return null;
    let target = null;
    for(let i=0;i<10;i++){
      target = document.querySelector(step.selector);
      if(target) break;
      await wait(80);
    }
    return target;
  }

  async function focusTarget(step){
    clearTarget();
    const target = await resolveTarget(step || {});
    if(target){
      activeTarget = target;
      activeTarget.classList.add('ae-tour-target');
      if(activeTarget.scrollIntoView){
        activeTarget.scrollIntoView({ behavior:'smooth', block:'center' });
      }
    }
  }

  async function applyStep(){
    if(!activeTour) return;
    const tour = getTour(activeTour.id);
    if(!tour) return;
    const step = tour.steps[activeTour.index];
    if(!step) return;
    if(step.tab) await switchToTab(step.tab);
    if(typeof step.before === 'function'){
      try{ await step.before(); }catch(_){}
    }
    await focusTarget(step);
    ensureOverlay();
    overlay.classList.remove('hidden');
    document.getElementById('aeFlowTourMeta').textContent = 'Step ' + (activeTour.index + 1) + ' / ' + tour.steps.length;
    document.getElementById('aeFlowTourTitle').textContent = step.title || tour.title;
    document.getElementById('aeFlowTourBody').textContent = step.body || '';
    document.getElementById('aeFlowTourBar').style.width = (((activeTour.index + 1) / tour.steps.length) * 100).toFixed(1) + '%';
    document.getElementById('aeFlowTourBackBtn').disabled = activeTour.index === 0;
    document.getElementById('aeFlowTourNextBtn').textContent = activeTour.index === tour.steps.length - 1 ? 'Finish' : 'Next';
    markProgress(activeTour.id, { lastStep: activeTour.index + 1, inProgress: true });
    injectEntryPoints();
  }

  async function moveStep(delta){
    if(!activeTour) return;
    const tour = getTour(activeTour.id);
    const nextIndex = activeTour.index + delta;
    if(nextIndex < 0) return;
    if(nextIndex >= tour.steps.length){
      markProgress(activeTour.id, { completedAt: new Date().toISOString(), inProgress: false, lastStep: tour.steps.length });
      const queue = Array.isArray(activeTour.queue) ? activeTour.queue.slice() : [];
      if(activeTour.mode === 'recommended' && queue.length === 0){
        saveOnboarding({ completedAt: new Date().toISOString() });
      }
      closeTour(false);
      toast('Walkthrough completed ✅');
      if(queue.length){
        await wait(140);
        startTour(queue[0], queue.slice(1), activeTour.mode || '');
      }else{
        openCenter();
      }
      return;
    }
    activeTour.index = nextIndex;
    await applyStep();
  }

  function closeTour(reopen=true){
    clearTarget();
    if(overlay) overlay.classList.add('hidden');
    if(activeTour){
      markProgress(activeTour.id, { inProgress:false });
    }
    activeTour = null;
    if(reopen){
      setTimeout(()=> openCenter(), 60);
    }
    injectEntryPoints();
  }

  function startTour(id, queue, mode){
    activeTour = { id, index:0, queue:Array.isArray(queue) ? queue : [], mode: clean(mode) || 'single' };
    applyStep();
  }

  function startAll(){
    const ids = getTours().map(t => t.id);
    if(!ids.length) return;
    startTour(ids[0], ids.slice(1), 'all');
  }

  function startRecommended(){
    const ids = recommendedTourIds();
    if(!ids.length) return;
    saveOnboarding({ startedAt: new Date().toISOString(), dismissedAt:'' });
    startTour(ids[0], ids.slice(1), 'recommended');
  }

  function coverageMatrixHtml(){
    const progress = readProgress();
    const rows = getCoverageItems().map(item => {
      const mappedTours = item.tours.map(id => getTour(id)).filter(Boolean);
      const completed = mappedTours.some(t => progress[t.id] && progress[t.id].completedAt);
      const launch = mappedTours[0] || null;
      return `<tr>
        <td>${esc(item.label)}</td>
        <td>${completed ? 'Covered' : 'Needs run'}</td>
        <td>${mappedTours.map(t => esc(t.title)).join('<br/>') || '—'}</td>
        <td>${launch ? `<button class="btn small" data-ae-tour="${esc(launch.id)}">Guide me</button>` : '—'}</td>
      </tr>`;
    }).join('');
    return `<table class="ae-tour-coverage"><thead><tr><th>Product area</th><th>Status</th><th>Walkthrough coverage</th><th>Launch</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function centerHtml(){
    const tours = getTours();
    const progress = readProgress();
    const done = tours.filter(t => progress[t.id] && progress[t.id].completedAt).length;
    return `
      <div class="muted">These walkthroughs are active product education. They switch tabs, land on live controls, and show the real AE FLOW surfaces users operate.</div>
      <div class="sep"></div>
      <div class="row" style="flex-wrap:wrap;">
        <div class="pill">${done}/${tours.length} walkthroughs completed</div>
        <button class="btn" id="aeFlowTourStartRecommended">Run recommended onboarding</button>
        <button class="btn" id="aeFlowTourStartAll">Run all walkthroughs</button>
        <button class="btn" id="aeFlowTourReset">Reset progress</button>
      </div>
      <div class="sep"></div>
      <h3 style="margin:0 0 8px;">Coverage matrix</h3>
      ${coverageMatrixHtml()}
      <div class="ae-tour-grid">
        ${tours.map(t => {
          const row = progress[t.id] || {};
          const status = row.completedAt ? 'Completed' : row.lastStep ? ('Last step ' + row.lastStep + '/' + t.steps.length) : 'Not started';
          return `<div class="ae-tour-tile">
            <h4>${esc(t.title)}</h4>
            <p>${esc(t.description)}</p>
            <div class="ae-tour-mini">${status} • Covers ${t.covers.length} product area(s)</div>
            <div class="sep"></div>
            <button class="btn small" data-ae-tour="${esc(t.id)}">Start walkthrough</button>
          </div>`;
        }).join('')}
      </div>
    `;
  }

  function bindCenter(){
    const recBtn = document.getElementById('aeFlowTourStartRecommended');
    if(recBtn) recBtn.onclick = ()=> startRecommended();
    const allBtn = document.getElementById('aeFlowTourStartAll');
    if(allBtn) allBtn.onclick = ()=> startAll();
    const resetBtn = document.getElementById('aeFlowTourReset');
    if(resetBtn) resetBtn.onclick = ()=>{ saveProgress({}); saveOnboarding({ startedAt:'', dismissedAt:'', completedAt:'' }); toast('Walkthrough progress reset'); openCenter(); injectEntryPoints(); };
    document.querySelectorAll('[data-ae-tour]').forEach(btn => btn.onclick = ()=> startTour(btn.getAttribute('data-ae-tour')));
  }

  function openCenter(){
    const old = document.getElementById('aeFlowTourCenterCard');
    if(old) old.remove();
    const wrap = document.createElement('div');
    wrap.className = 'card';
    wrap.id = 'aeFlowTourCenterCard';
    wrap.innerHTML = `<h2 style="margin:0 0 10px;">Interactive walkthrough center</h2>${centerHtml()}`;
    const host = document.getElementById('tab-settings') || document.querySelector('.wrap');
    if(host){
      host.prepend(wrap);
      bindCenter();
      switchToTab('settings');
      wrap.scrollIntoView({ behavior:'smooth', block:'start' });
    }
  }

  function maybePromptOnboarding(){
    if(onboardingPrompted) return;
    onboardingPrompted = true;
    const progress = readProgress();
    if(Object.keys(progress).length) return;
    const state = readOnboarding();
    if(state.dismissedAt || state.completedAt || state.startedAt) return;
    setTimeout(()=>{
      const host = document.getElementById('tab-settings') || document.querySelector('.wrap');
      if(!host || document.getElementById('aeFlowOnboardingCard')) return;
      switchToTab('settings');
      const card = document.createElement('div');
      card.className = 'card';
      card.id = 'aeFlowOnboardingCard';
      card.innerHTML = `
        <h2>Start guided onboarding</h2>
        <div class="muted">AE FLOW now includes screen-changing walkthroughs. The recommended onboarding runs the key tours in order so a new operator can learn the app without guessing.</div>
        <div class="sep"></div>
        <div class="row" style="flex-wrap:wrap;">
          <button class="btn" id="aeFlowOnboardingStartBtn">Start recommended onboarding</button>
          <button class="btn" id="aeFlowOnboardingCenterBtn">Open tutorial center</button>
          <button class="btn danger" id="aeFlowOnboardingDismissBtn">Not now</button>
        </div>`;
      host.prepend(card);
      document.getElementById('aeFlowOnboardingStartBtn')?.addEventListener('click', ()=>{ saveOnboarding({ startedAt:new Date().toISOString() }); card.remove(); startRecommended(); });
      document.getElementById('aeFlowOnboardingCenterBtn')?.addEventListener('click', ()=>{ card.remove(); openCenter(); });
      document.getElementById('aeFlowOnboardingDismissBtn')?.addEventListener('click', ()=>{ saveOnboarding({ dismissedAt:new Date().toISOString() }); card.remove(); });
    }, 700);
  }

  function injectTopbarButton(){
    const host = document.querySelector('.topbar .row');
    if(host && !document.getElementById('aeFlowToursBtn')){
      const btn = document.createElement('button');
      btn.className = 'btn small';
      btn.id = 'aeFlowToursBtn';
      btn.textContent = 'Tours';
      btn.onclick = openCenter;
      host.appendChild(btn);
    }
  }

  function injectSettingsCard(){
    const host = document.getElementById('tab-settings');
    if(host && !document.getElementById('aeFlowToursSettingsCard')){
      const done = completedCount();
      const total = getTours().length;
      const card = document.createElement('div');
      card.className = 'card';
      card.id = 'aeFlowToursSettingsCard';
      card.innerHTML = `
        <h2>Walkthrough and tutorial center</h2>
        <div class="muted">AE FLOW now teaches itself in-product. Starting a walkthrough switches tabs and shows the real surfaces the operator needs to use.</div>
        <div class="sep"></div>
        <div class="row" style="flex-wrap:wrap;">
          <div class="pill">${done}/${total} completed</div>
          <button class="btn" id="aeFlowToursOpenFromSettings">Open walkthrough center</button>
          <button class="btn" id="aeFlowToursRunRecommendedFromSettings">Run recommended onboarding</button>
          <button class="btn" id="aeFlowToursRunAllFromSettings">Run all walkthroughs</button>
        </div>
      `;
      host.prepend(card);
      document.getElementById('aeFlowToursOpenFromSettings')?.addEventListener('click', openCenter);
      document.getElementById('aeFlowToursRunRecommendedFromSettings')?.addEventListener('click', startRecommended);
      document.getElementById('aeFlowToursRunAllFromSettings')?.addEventListener('click', startAll);
    }
  }

  function attachLauncherAfter(target, id, label, handler){
    if(!target || document.getElementById(id)) return;
    const btn = document.createElement('button');
    btn.className = 'btn small ae-help-launch';
    btn.id = id;
    btn.type = 'button';
    btn.textContent = label;
    btn.onclick = handler;
    target.insertAdjacentElement('afterend', btn);
  }

  function injectContextualHelp(){
    const specs = [
      { selector:'#aeRoutexQueueVisible', id:'aeHelpRoutexQueue', label:'Guide', tour:'aeflow-accounts-to-routex' },
      { selector:'#aeRoutexSaveSeed', id:'aeHelpRoutexSeed', label:'Guide', tour:'aeflow-accounts-to-routex' },
      { selector:'#aeRoutexLaunchBoardSyncBtn', id:'aeHelpLaunchBoardSync', label:'Guide', tour:'aeflow-bridge-sync-inboxes' },
      { selector:'#aeRoutexOpsBriefSyncBtn', id:'aeHelpOpsBriefSync', label:'Guide', tour:'aeflow-bridge-sync-inboxes' },
      { selector:'#aeRoutexHandoffPacketSyncBtn', id:'aeHelpHandoffSync', label:'Guide', tour:'aeflow-bridge-sync-inboxes' },
      { selector:'#aeRoutexCompletionBinderSyncBtn', id:'aeHelpBinderSync', label:'Guide', tour:'aeflow-bridge-sync-inboxes' },
      { selector:'#aeRoutexLegacySyncBtn', id:'aeHelpLegacySync', label:'Guide', tour:'aeflow-lineage-and-transfer' },
      { selector:'#aeRoutexTransferSyncBtn', id:'aeHelpTransferSync', label:'Guide', tour:'aeflow-lineage-and-transfer' },
      { selector:'#aeRoutexCapsuleSyncBtn', id:'aeHelpCapsuleSync', label:'Guide', tour:'aeflow-lineage-and-transfer' },
      { selector:'#aeRoutexAttestSyncBtn', id:'aeHelpAttestSync', label:'Guide', tour:'aeflow-lineage-and-transfer' },
      { selector:'#saveSettingsBtn', id:'aeHelpSaveSettings', label:'Guide', tour:'aeflow-settings-and-tutorials' }
    ];
    specs.forEach(spec => {
      const target = document.querySelector(spec.selector);
      if(target) attachLauncherAfter(target, spec.id, spec.label, ()=> startTour(spec.tour));
    });
  }

  function injectLaunchpad(){
    const host = document.getElementById('tab-intake');
    if(host && !document.getElementById('aeFlowTourLaunchpadCard')){
      const nextTour = recommendedTourIds()[0];
      const nextLabel = getTour(nextTour) ? getTour(nextTour).title : 'Recommended onboarding';
      const card = document.createElement('div');
      card.className = 'card ae-tour-launchpad';
      card.id = 'aeFlowTourLaunchpadCard';
      card.innerHTML = `
        <h2>Interactive walkthrough launchpad</h2>
        <div class="muted">AE FLOW now teaches itself in-product with guided, screen-changing walkthroughs.</div>
        <div class="sep"></div>
        <div class="row" style="flex-wrap:wrap;">
          <div class="pill">${completedCount()}/${getTours().length} walkthroughs completed</div>
          <div class="pill">Next recommended: ${esc(nextLabel)}</div>
          <button class="btn" id="aeFlowLaunchpadCenterBtn">Open tutorial center</button>
          <button class="btn" id="aeFlowLaunchpadRecommendedBtn">Run recommended onboarding</button>
        </div>`;
      host.prepend(card);
      document.getElementById('aeFlowLaunchpadCenterBtn')?.addEventListener('click', openCenter);
      document.getElementById('aeFlowLaunchpadRecommendedBtn')?.addEventListener('click', startRecommended);
    }
  }

  function injectEntryPoints(){
    injectTopbarButton();
    injectSettingsCard();
    injectLaunchpad();
    injectContextualHelp();
  }

  const prevRenderAll = window.renderAll;
  if(typeof prevRenderAll === 'function'){
    window.renderAll = function(){
      const out = prevRenderAll.apply(this, arguments);
      setTimeout(()=>{ injectEntryPoints(); maybePromptOnboarding(); }, 0);
      return out;
    };
  }

  const observer = new MutationObserver(()=> injectEntryPoints());
  observer.observe(document.documentElement || document.body, { childList:true, subtree:true });

  window.openAEFlowTutorialCenter = openCenter;
  window.startAEFlowInteractiveTour = startTour;
  window.startAEFlowRecommendedOnboarding = startRecommended;

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ()=> setTimeout(()=>{ injectEntryPoints(); maybePromptOnboarding(); }, 140));
  }else{
    setTimeout(()=>{ injectEntryPoints(); maybePromptOnboarding(); }, 140);
  }
})();


/* V37 AE FLOW academy add-on: role packs, micro guides, analytics heatmap, inline explainers */
(function(){
  if(window.__AEFLOW_V37_ACADEMY__) return;
  window.__AEFLOW_V37_ACADEMY__ = true;

  const FULL_PROGRESS_KEY = 'skye_aeflow_tutorial_progress_v2';
  const MINI_PROGRESS_KEY = 'skye_aeflow_mini_progress_v1';
  const toast = window.toast || function(){};
  const wait = (ms)=> new Promise(resolve => setTimeout(resolve, ms));
  const esc = (v)=> String(v == null ? '' : v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const clean = (v)=> String(v == null ? '' : v).trim();
  let overlay = null, active = null, activeTarget = null, pendingExplainer = null;

  function readJSON(key, fallback){ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } }
  function writeJSON(key, value){ try{ localStorage.setItem(key, JSON.stringify(value)); }catch(_){} return value; }
  function readFull(){ return readJSON(FULL_PROGRESS_KEY, {}); }
  function readMini(){ return readJSON(MINI_PROGRESS_KEY, {}); }
  function saveMini(next){ return writeJSON(MINI_PROGRESS_KEY, next || {}); }
  function markMini(id, patch){ const next = readMini(); next[id] = Object.assign({}, next[id]||{}, patch||{}, {updatedAt:new Date().toISOString()}); saveMini(next); return next[id]; }
  function latestRows(){
    const rows=[]; Object.entries(readFull()).forEach(([id,row])=> rows.push({kind:'Tour', id, updatedAt:String((row||{}).updatedAt||''), done:!!(row&&row.completedAt)}));
    Object.entries(readMini()).forEach(([id,row])=> rows.push({kind:'Micro', id, updatedAt:String((row||{}).updatedAt||''), done:!!(row&&row.completedAt)}));
    return rows.filter(r=>r.updatedAt).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,8);
  }
  function ensureStyle(){
    if(document.getElementById('aeFlowAcademyV37Styles')) return;
    const style = document.createElement('style');
    style.id = 'aeFlowAcademyV37Styles';
    style.textContent = `
      .ae-academy-target{ position:relative !important; z-index:10012 !important; box-shadow:0 0 0 3px rgba(245,197,66,.95),0 0 0 9999px rgba(5,1,12,.56) !important; border-radius:16px !important; }
      .ae-academy-overlay{ position:fixed; inset:0; z-index:10011; pointer-events:none; }
      .ae-academy-dock{ position:fixed; left:16px; bottom:96px; width:min(400px, calc(100vw - 24px)); border:1px solid rgba(255,255,255,.14); border-radius:20px; background:linear-gradient(180deg, rgba(26,10,45,.97), rgba(9,4,18,.95)); box-shadow:0 26px 80px rgba(0,0,0,.48); padding:16px; color:#fff; pointer-events:auto; }
      .ae-academy-dock h3{ margin:0 0 8px; font-size:18px; font-weight:900; }
      .ae-academy-dock p{ margin:0; font-size:13px; line-height:1.5; color:rgba(255,255,255,.82); white-space:pre-wrap; }
      .ae-academy-bar{ height:7px; border-radius:999px; background:rgba(255,255,255,.10); overflow:hidden; margin:12px 0; }
      .ae-academy-bar > i{ display:block; height:100%; width:0; background:linear-gradient(90deg, rgba(245,197,66,.95), rgba(124,58,237,.92)); }
      .ae-academy-grid{ display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:10px; margin-top:12px; }
      .ae-academy-card{ border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.04); border-radius:16px; padding:12px; }
      .ae-academy-card h4{ margin:0 0 6px; font-size:14px; }
      .ae-academy-card p{ margin:0 0 8px; font-size:12px; line-height:1.45; color:rgba(255,255,255,.72); }
      .ae-academy-mini{ font-size:11px; color:rgba(255,255,255,.62); }
      .ae-academy-table{ width:100%; border-collapse:collapse; margin-top:12px; }
      .ae-academy-table th,.ae-academy-table td{ padding:8px; border-bottom:1px solid rgba(255,255,255,.08); text-align:left; vertical-align:top; font-size:12px; }
      .ae-academy-heat{ display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:10px; margin-top:12px; }
      .ae-academy-heatcell{ border-radius:14px; padding:10px; border:1px solid rgba(255,255,255,.10); }
      .ae-academy-heatcell.ok{ background:rgba(16,185,129,.14); }
      .ae-academy-heatcell.warn{ background:rgba(245,158,11,.14); }
      .ae-academy-heatcell h5{ margin:0 0 4px; font-size:12px; }
      .ae-academy-explainer{ margin:0 0 12px; padding:12px; border-radius:14px; border:1px solid rgba(245,197,66,.25); background:rgba(245,197,66,.08); }
      .ae-academy-explainer h4{ margin:0 0 6px; font-size:13px; }
      .ae-academy-explainer p{ margin:0 0 10px; font-size:12px; line-height:1.45; color:rgba(255,255,255,.82); }
    `;
    document.head.appendChild(style);
  }
  function getMiniGuides(){
    return [
      { id:'mini-routex-seed', title:'Micro guide • Queue visible accounts', description:'Shortest bridge path from visible accounts into Routex-ready queue and seed exports.', steps:[
        { tab:'accounts', selector:'#aeRoutexQueueVisible', title:'Queue visible accounts', body:'This is the fastest bridge move when the current account slice should become Routex-visible work.' },
        { tab:'accounts', selector:'#aeRoutexSaveSeed', title:'Save Routex seed', body:'Seeds make that visible account slice reusable instead of one-time only.' },
        { tab:'accounts', selector:'#aeRoutexExportSeed', title:'Export seed', body:'The export side keeps the bridge portable and reviewable.' }
      ]},
      { id:'mini-proof-record', title:'Micro guide • Record proof and export', description:'Quick proof pass from record view to export.', steps:[
        { tab:'accounts', selector:'#aeRoutexViewProof', title:'Record proof view', body:'Proof is visible inside the record workflow so operators do not lose context.' },
        { tab:'accounts', selector:'#aeRoutexViewProofExport', title:'Record proof export', body:'This is the shortest path from account record to portable proof artifact.' }
      ]},
      { id:'mini-sync-command', title:'Micro guide • Sync command row', description:'Fast pass across launch board, ops brief, handoff, binder, and receipt sync controls.', steps:[
        { tab:'accounts', selector:'#aeRoutexLaunchBoardSyncBtn', title:'Launch board sync', body:'The launch board keeps readiness visible across the bridge.' },
        { tab:'accounts', selector:'#aeRoutexOpsBriefSyncBtn', title:'Ops brief sync', body:'Ops briefs carry the current Routex command snapshot into AE FLOW.' },
        { tab:'accounts', selector:'#aeRoutexHandoffPacketSyncBtn', title:'Handoff packet sync', body:'Handoff packets move closeout context into the AE side for review.' },
        { tab:'accounts', selector:'#aeRoutexCompletionBinderSyncBtn', title:'Completion binder sync', body:'The binder is the final no-dead closeout artifact, not just another random file.' }
      ]},
      { id:'mini-lineage-sync', title:'Micro guide • Legacy, transfer, attestation', description:'Short lineage pass for legacy sync, capsules, and attestations.', steps:[
        { tab:'accounts', selector:'#aeRoutexLegacySyncBtn', title:'Legacy sync', body:'Legacy sync keeps prior proof packages visible inside AE FLOW.' },
        { tab:'accounts', selector:'#aeRoutexTransferSyncBtn', title:'Transfer sync', body:'Transfer proof shows portable export/import confidence across the bridge.' },
        { tab:'accounts', selector:'#aeRoutexCapsuleSyncBtn', title:'Capsule sync', body:'Capsules are portable proof units for staged reopen and cross-device movement.' },
        { tab:'accounts', selector:'#aeRoutexAttestSyncBtn', title:'Attestation sync', body:'Attestations make device-level proof visible in the AE work surface.' }
      ]},
      { id:'mini-settings-recovery', title:'Micro guide • Settings and recovery', description:'Fast pass for presets, resets, and tutorial access.', steps:[
        { tab:'settings', selector:'#saveSettingsBtn', title:'Save settings', body:'Settings persist brand defaults, deposit presets, and operator behavior.' },
        { tab:'settings', selector:'#resetSettingsBtn', title:'Reset settings', body:'Reset exists for testing and recovery, so it is taught instead of hidden.' }
      ]}
    ];
  }
  function getMiniGuide(id){ return getMiniGuides().find(g => g.id === id) || null; }
  function getRolePacks(){
    return [
      { id:'pack-ae-core', title:'AE core pack', summary:'Core AE FLOW, Routex seed bridge, proof records, and settings.', guides:[['tour','aeflow-start-here'],['tour','aeflow-accounts-to-routex'],['mini','mini-proof-record'],['mini','mini-settings-recovery']] },
      { id:'pack-bridge-command', title:'Bridge command pack', summary:'Seed bridge, sync command row, launch board, handoff, binder, and receipt visibility.', guides:[['tour','aeflow-bridge-sync-inboxes'],['mini','mini-routex-seed'],['mini','mini-sync-command']] },
      { id:'pack-lineage-trust', title:'Lineage and trust pack', summary:'Legacy sync, transfer compare, capsules, attestations, and settings recovery.', guides:[['tour','aeflow-lineage-and-transfer'],['mini','mini-lineage-sync'],['mini','mini-settings-recovery']] }
    ];
  }
  function coverageRows(){
    const full = readFull(), mini = readMini();
    return [
      { area:'Core AE FLOW', ok: !!(full['aeflow-start-here'] && full['aeflow-start-here'].completedAt) },
      { area:'Routex seed bridge', ok: !!((full['aeflow-accounts-to-routex'] && full['aeflow-accounts-to-routex'].completedAt) || (mini['mini-routex-seed'] && mini['mini-routex-seed'].completedAt)) },
      { area:'Proof and record exports', ok: !!((full['aeflow-proof-and-proposals'] && full['aeflow-proof-and-proposals'].completedAt) || (mini['mini-proof-record'] && mini['mini-proof-record'].completedAt)) },
      { area:'Sync command row', ok: !!((full['aeflow-bridge-sync-inboxes'] && full['aeflow-bridge-sync-inboxes'].completedAt) || (mini['mini-sync-command'] && mini['mini-sync-command'].completedAt)) },
      { area:'Lineage and attestation', ok: !!((full['aeflow-lineage-and-transfer'] && full['aeflow-lineage-and-transfer'].completedAt) || (mini['mini-lineage-sync'] && mini['mini-lineage-sync'].completedAt)) },
      { area:'Settings and recovery', ok: !!((full['aeflow-settings-and-tutorials'] && full['aeflow-settings-and-tutorials'].completedAt) || (mini['mini-settings-recovery'] && mini['mini-settings-recovery'].completedAt)) }
    ];
  }
  function analyticsHtml(){
    const fullCount = Object.values(readFull()).filter(v=>v&&v.completedAt).length;
    const miniCount = Object.values(readMini()).filter(v=>v&&v.completedAt).length;
    const rows = latestRows();
    return `<div class="row" style="flex-wrap:wrap; gap:8px; margin-bottom:10px;"><div class="pill">Full walkthroughs ${fullCount}/6</div><div class="pill">Micro guides ${miniCount}/${getMiniGuides().length}</div><div class="pill">Coverage ${coverageRows().filter(r=>r.ok).length}/${coverageRows().length}</div></div>
      <div class="ae-academy-heat">${coverageRows().map(row => `<div class="ae-academy-heatcell ${row.ok ? 'ok' : 'warn'}"><h5>${esc(row.area)}</h5><div class="ae-academy-mini">${row.ok ? 'Covered' : 'Needs guided pass'}</div></div>`).join('')}</div>
      <table class="ae-academy-table"><thead><tr><th>Recent learning activity</th><th>Type</th><th>Status</th></tr></thead><tbody>${rows.length ? rows.map(row => `<tr><td>${esc(row.id)}</td><td>${esc(row.kind)}</td><td>${row.done ? 'Completed' : 'In progress'}</td></tr>`).join('') : '<tr><td colspan="3">No guided activity recorded yet.</td></tr>'}</tbody></table>`;
  }
  function switchTab(tabId){
    return (async ()=>{
      try{
        if(typeof window.APP === 'object'){ APP.tab = tabId; }
        if(typeof window.render === 'function') await window.render();
      }catch(_){}
      await wait(140);
    })();
  }
  function ensureOverlay(){
    ensureStyle();
    if(overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'ae-academy-overlay hidden';
    overlay.id = 'aeFlowAcademyOverlay';
    overlay.innerHTML = `<div class="ae-academy-dock"><div class="pill" id="aeAcademyMeta">Step 1 / 1</div><h3 id="aeAcademyTitle">AE FLOW academy guide</h3><p id="aeAcademyBody"></p><div class="ae-academy-bar"><i id="aeAcademyBar"></i></div><div class="row" style="flex-wrap:wrap; gap:8px;"><button class="btn small" id="aeAcademyBackBtn" type="button">Back</button><button class="btn small" id="aeAcademyNextBtn" type="button">Next</button><div class="spacer"></div><button class="btn small" id="aeAcademyHubBtn" type="button">Academy</button><button class="btn small danger" id="aeAcademyCloseBtn" type="button">Close</button></div></div>`;
    document.body.appendChild(overlay);
    document.getElementById('aeAcademyBackBtn').onclick = ()=> moveMini(-1);
    document.getElementById('aeAcademyNextBtn').onclick = ()=> moveMini(1);
    document.getElementById('aeAcademyHubBtn').onclick = ()=> openAcademyCenter();
    document.getElementById('aeAcademyCloseBtn').onclick = ()=> closeMini();
    return overlay;
  }
  function clearTarget(){ if(activeTarget){ activeTarget.classList.remove('ae-academy-target'); activeTarget = null; } }
  async function resolveTarget(step){ let el=null; for(let i=0;i<10;i++){ el = step.selector ? document.querySelector(step.selector) : null; if(el) break; await wait(80); } return el; }
  async function applyMini(){
    if(!active) return; const guide = getMiniGuide(active.id); if(!guide) return; const step = guide.steps[active.index]; if(!step) return;
    if(step.tab) await switchTab(step.tab);
    clearTarget(); const target = await resolveTarget(step); if(target){ activeTarget = target; target.classList.add('ae-academy-target'); target.scrollIntoView?.({behavior:'smooth', block:'center', inline:'center'}); }
    ensureOverlay(); overlay.classList.remove('hidden'); document.getElementById('aeAcademyMeta').textContent = 'Step ' + (active.index + 1) + ' / ' + guide.steps.length; document.getElementById('aeAcademyTitle').textContent = step.title || guide.title; document.getElementById('aeAcademyBody').textContent = step.body || ''; document.getElementById('aeAcademyBar').style.width = (((active.index + 1) / guide.steps.length) * 100).toFixed(1) + '%'; document.getElementById('aeAcademyBackBtn').disabled = active.index === 0; document.getElementById('aeAcademyNextBtn').textContent = active.index === guide.steps.length - 1 ? 'Finish' : 'Next'; markMini(active.id, { inProgress:true, lastStep:active.index + 1 });
  }
  async function moveMini(delta){
    if(!active) return; const guide = getMiniGuide(active.id); if(!guide) return; const next = active.index + delta; if(next < 0) return; if(next >= guide.steps.length){ markMini(active.id, { inProgress:false, completedAt:new Date().toISOString(), lastStep:guide.steps.length }); closeMini(); toast('Micro guide completed.','good'); openAcademyCenter(); return; } active.index = next; await applyMini();
  }
  function closeMini(){ clearTarget(); if(overlay) overlay.classList.add('hidden'); active = null; }
  function startMini(id){ if(!getMiniGuide(id)) return; active = { id, index:0 }; applyMini(); }
  function launchItem(type, id){ if(type === 'tour'){ closeMini(); if(typeof window.startAEFlowTour === 'function') window.startAEFlowTour(id); return; } startMini(id); }
  function currentPageGuide(){
    const tab = window.APP && APP.tab || 'intake';
    if(tab === 'intake') return { type:'tour', id:'aeflow-start-here', title:'Page guide • Core AE FLOW' };
    if(tab === 'accounts') return { type:'mini', id:'mini-routex-seed', title:'Page guide • Routex seed bridge' };
    if(tab === 'deals') return { type:'tour', id:'aeflow-proof-and-proposals', title:'Page guide • Deals and proof' };
    if(tab === 'settings') return { type:'mini', id:'mini-settings-recovery', title:'Page guide • Settings recovery' };
    return { type:'tour', id:'aeflow-start-here', title:'Page guide • Core AE FLOW' };
  }
  function openPack(packId){
    const pack = getRolePacks().find(p => p.id === packId); if(!pack || typeof window.openModal !== 'function') return;
    const body = `<div class="hint">${esc(pack.summary)}</div><div class="sep"></div><div class="ae-academy-grid">${pack.guides.map((row, idx) => { const label = row[0] === 'tour' ? row[1] : (getMiniGuide(row[1])?.title || row[1]); return `<div class="ae-academy-card"><h4>Step ${idx+1}</h4><p>${esc(label)}</p><button class="btn small" data-ae-pack-launch="${esc(row[0])}::${esc(row[1])}">Launch</button></div>`; }).join('')}</div>`;
    window.openModal(pack.title, body, `<button class="btn" onclick="document.getElementById('modalClose').click()">Close</button>`);
    document.querySelectorAll('[data-ae-pack-launch]').forEach(btn => btn.onclick = ()=>{ const [type,id] = String(btn.getAttribute('data-ae-pack-launch')||'').split('::'); document.getElementById('modalClose')?.click(); launchItem(type,id); });
  }
  function academyHtml(){
    const pageGuide = currentPageGuide();
    return `<div class="hint">AE FLOW Academy adds role-based packs, micro guides, page-aware guidance, and a learning heatmap so the bridge lanes teach themselves instead of staying hidden behind toolbar buttons.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap; gap:8px;"><button class="btn" id="aeAcademyPageBtn">Run ${esc(pageGuide.title)}</button></div><div class="sep"></div><h3 style="margin:0 0 8px;">Learning analytics and heatmap</h3>${analyticsHtml()}<div class="sep"></div><h3 style="margin:0 0 8px;">Role-based onboarding packs</h3><div class="ae-academy-grid">${getRolePacks().map(pack => `<div class="ae-academy-card"><h4>${esc(pack.title)}</h4><p>${esc(pack.summary)}</p><div class="ae-academy-mini">${pack.guides.length} guided moves</div><div class="sep"></div><button class="btn small" data-ae-pack="${esc(pack.id)}">Open pack</button></div>`).join('')}</div><div class="sep"></div><h3 style="margin:0 0 8px;">Micro walkthrough library</h3><div class="ae-academy-grid">${getMiniGuides().map(g => `<div class="ae-academy-card"><h4>${esc(g.title)}</h4><p>${esc(g.description)}</p><div class="ae-academy-mini">${g.steps.length} screen-changing step(s)</div><div class="sep"></div><button class="btn small" data-ae-mini="${esc(g.id)}">Start micro guide</button></div>`).join('')}</div>`;
  }
  function bindAcademy(){
    document.getElementById('aeAcademyPageBtn')?.addEventListener('click', ()=>{ const guide = currentPageGuide(); document.getElementById('modalClose')?.click(); launchItem(guide.type, guide.id); });
    document.querySelectorAll('[data-ae-pack]').forEach(btn => btn.onclick = ()=> openPack(btn.getAttribute('data-ae-pack')));
    document.querySelectorAll('[data-ae-mini]').forEach(btn => btn.onclick = ()=>{ const id = btn.getAttribute('data-ae-mini'); document.getElementById('modalClose')?.click(); startMini(id); });
  }
  function openAcademyCenter(){ if(typeof window.openModal !== 'function') return; window.openModal('AE FLOW Academy', academyHtml(), `<button class="btn" onclick="document.getElementById('modalClose').click()">Close</button>`); bindAcademy(); }
  function injectButtons(){
    ensureStyle();
    const top = document.querySelector('.topbar .row:last-of-type') || document.querySelector('.topbar .row');
    if(top && !document.getElementById('aeAcademyTopBtn')){ const btn=document.createElement('button'); btn.className='btn'; btn.id='aeAcademyTopBtn'; btn.textContent='Academy'; top.appendChild(btn); btn.onclick=openAcademyCenter; }
    if(top && !document.getElementById('aePageGuideTopBtn')){ const btn=document.createElement('button'); btn.className='btn'; btn.id='aePageGuideTopBtn'; btn.textContent='Page guide'; top.appendChild(btn); btn.onclick=()=>{ const guide=currentPageGuide(); launchItem(guide.type, guide.id); }; }
    const mount = document.querySelector('#tab-settings') || document.querySelector('.settings') || document.querySelector('#app');
    if(mount && !document.getElementById('aeAcademySettingsCard') && window.APP && APP.tab === 'settings'){
      const card = document.createElement('div'); card.className='card'; card.id='aeAcademySettingsCard'; card.innerHTML = `<h2>Academy, role packs, and explainers</h2><div class="hint">AE FLOW now ships with role packs, micro guides, page-aware guidance, and inline explainers for bridge-heavy surfaces.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap; gap:8px;"><button class="btn" id="aeAcademyOpenBtn">Open academy</button><button class="btn" id="aeAcademyPageGuideBtn">Run page guide</button></div>`; mount.prepend(card); document.getElementById('aeAcademyOpenBtn')?.addEventListener('click', openAcademyCenter); document.getElementById('aeAcademyPageGuideBtn')?.addEventListener('click', ()=>{ const guide=currentPageGuide(); launchItem(guide.type, guide.id); });
    }
    const launchpad = document.querySelector('#app');
    if(launchpad && !document.getElementById('aeAcademyLaunchpad') && window.APP && APP.tab === 'accounts'){
      const card = document.createElement('div'); card.className='card'; card.id='aeAcademyLaunchpad'; card.innerHTML = `<h2>AE FLOW Academy</h2><div class="hint">Use the Academy when you want the bridge, proof, or sync layers explained while you are standing on the actual screen.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap; gap:8px;"><div class="pill">Micro guides ${Object.values(readMini()).filter(v=>v&&v.completedAt).length}/${getMiniGuides().length}</div><button class="btn" id="aeAcademyLaunchpadOpen">Open academy</button><button class="btn" id="aeAcademyLaunchpadPage">Run page guide</button></div>`; launchpad.prepend(card); document.getElementById('aeAcademyLaunchpadOpen')?.addEventListener('click', openAcademyCenter); document.getElementById('aeAcademyLaunchpadPage')?.addEventListener('click', ()=>{ const guide=currentPageGuide(); launchItem(guide.type, guide.id); });
    }
  }
  function explainerSpecs(){ return [
    { selector:'#aeRoutexQueueVisible', title:'Routex queue lane', body:'Queue visible accounts when the current slice should become Routex-visible work instead of staying only in AE FLOW.', type:'mini', id:'mini-routex-seed' },
    { selector:'#aeRoutexViewProof', title:'Record proof lane', body:'This record view proves that proof and proof export are part of the AE workflow, not hidden in another app.', type:'mini', id:'mini-proof-record' },
    { selector:'#aeRoutexLaunchBoardSyncBtn', title:'Sync command row', body:'These sync buttons import the Routex readiness stack into AE FLOW so bridge visibility is explicit.', type:'mini', id:'mini-sync-command' },
    { selector:'#aeRoutexLegacySyncBtn', title:'Lineage and attestation lane', body:'Legacy, transfer, capsules, and attestations keep history and proof visible across the bridge.', type:'mini', id:'mini-lineage-sync' },
    { selector:'#saveSettingsBtn', title:'Settings recovery lane', body:'Settings save, reset, and tutorial access are part of daily use, not buried cleanup actions.', type:'mini', id:'mini-settings-recovery' }
  ]; }
  function matchExplainerByTitle(title){ const t = clean(title).toLowerCase(); if(t.includes('academy')) return { title:'AE FLOW Academy', body:'The Academy extends the existing tutorial layer with role packs, micro guides, page-aware guidance, and a learning heatmap.', type:'mini', id:'mini-routex-seed' }; if(t.includes('settings')) return { title:'Settings recovery lane', body:'Use the settings micro guide when you want presets, reset behavior, and the built-in tutorial access explained on-screen.', type:'mini', id:'mini-settings-recovery' }; return null; }
  function injectModalExplainer(title){ ensureStyle(); const spec = pendingExplainer || matchExplainerByTitle(title); pendingExplainer = null; if(!spec) return; const body = document.getElementById('modalBody') || document.querySelector('#modalWrap .modal-body') || document.querySelector('#modalWrap .body'); if(!body || body.querySelector('.ae-academy-explainer')) return; const box = document.createElement('div'); box.className='ae-academy-explainer'; box.innerHTML = `<h4>${esc(spec.title)}</h4><p>${esc(spec.body)}</p><div class="row" style="flex-wrap:wrap; gap:8px;"><button class="btn small" id="aeAcademyExplainerGuideBtn" type="button">Start guide</button><button class="btn small" id="aeAcademyExplainerOpenBtn" type="button">Open academy</button></div>`; body.prepend(box); document.getElementById('aeAcademyExplainerGuideBtn')?.addEventListener('click', ()=>{ document.getElementById('modalClose')?.click(); launchItem(spec.type, spec.id); }); document.getElementById('aeAcademyExplainerOpenBtn')?.addEventListener('click', ()=>{ document.getElementById('modalClose')?.click(); openAcademyCenter(); }); }
  document.addEventListener('click', (ev)=>{ const target = ev.target; for(const spec of explainerSpecs()){ try{ if(target && target.closest && target.closest(spec.selector)){ pendingExplainer = spec; break; } }catch(_){} } }, true);
  if(typeof window.openModal === 'function' && !window.__AEFLOW_V37_OPENMODAL_WRAPPED__){ const prev = window.openModal; window.__AEFLOW_V37_OPENMODAL_WRAPPED__ = true; window.openModal = function(title, body, footer){ const out = prev.apply(this, arguments); setTimeout(()=> injectModalExplainer(title), 0); return out; }; }
  const observer = new MutationObserver(()=> injectButtons()); observer.observe(document.documentElement || document.body, { childList:true, subtree:true });
  const prevRender = window.render; if(typeof prevRender === 'function' && !window.__AEFLOW_V37_RENDER_WRAPPED__){ window.__AEFLOW_V37_RENDER_WRAPPED__ = true; window.render = async function(){ const out = await prevRender.apply(this, arguments); setTimeout(()=> injectButtons(), 0); return out; }; }
  window.openAEFlowAcademyCenter = openAcademyCenter; window.startAEFlowMiniGuide = startMini;
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ()=> setTimeout(()=> injectButtons(), 120)); else setTimeout(()=> injectButtons(), 120);
})();
