
/* V36 Routex interactive walkthrough system */
(function(){
  if(window.__ROUTEX_V36_TOURS__) return;
  window.__ROUTEX_V36_TOURS__ = true;

  const PROGRESS_KEY = 'skye_routex_tutorial_progress_v2';
  const CENTER_STATE_KEY = 'skye_routex_tutorial_center_state_v2';
  const ONBOARDING_KEY = 'skye_routex_tutorial_onboarding_v1';

  const clean = (v)=> String(v == null ? '' : v).trim();
  const esc = (v)=> String(v == null ? '' : v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const wait = (ms)=> new Promise(resolve => setTimeout(resolve, ms));
  const toast = window.toast || function(){};

  let overlay = null;
  let activeTourState = null;
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
  function readCenterState(){ return readJSON(CENTER_STATE_KEY, { seenAt:'', lastOpenedTour:'' }); }
  function saveCenterState(patch){ return writeJSON(CENTER_STATE_KEY, Object.assign({}, readCenterState(), patch || {})); }
  function readOnboarding(){ return readJSON(ONBOARDING_KEY, { promptedAt:'', dismissedAt:'', startedAt:'', completedAt:'' }); }
  function saveOnboarding(patch){ return writeJSON(ONBOARDING_KEY, Object.assign({}, readOnboarding(), patch || {})); }

  function markProgress(tourId, patch){
    const next = readProgress();
    next[tourId] = Object.assign({}, next[tourId] || {}, patch || {}, { updatedAt: new Date().toISOString() });
    saveProgress(next);
    return next[tourId];
  }

  function closeAnyModal(){
    const closeBtn = document.getElementById('modalClose');
    const wrap = document.getElementById('modalWrap');
    if(closeBtn && wrap && wrap.getAttribute('aria-hidden') !== 'true'){
      closeBtn.click();
    }
  }

  function getTours(){
    return [
      {
        id: 'start-here',
        title: 'Start here • Core navigation',
        description: 'Full first-use pass through dashboard, route creation, route list, proof, export, and settings.',
        covers: ['dashboard','route-creation','route-list','proof-center','export-center','settings-center'],
        steps: [
          { view:'dashboard', title:'Dashboard', body:'This is the live command surface. It shows route health, balances, reminders, and quick-launch controls.' },
          { view:'dashboard', selector:'#primaryAction', title:'Primary action button', body:'The primary button changes with the screen. On Dashboard it is the fastest way to start the next operational move.' },
          { view:'dashboard', before: async ()=>{ closeAnyModal(); if(typeof window.openNewRouteModal === 'function') window.openNewRouteModal(); await wait(160); }, selector:'#nr_name', title:'Route creation form', body:'This walkthrough moves into the real route form so the user sees name, date, driver, vehicle, and territory controls in the live product.' },
          { view:'routes', selector:'#routesOpenAEFlow', title:'Routes screen', body:'Routes is the operational list. This is where the user manages route inventory and can bridge AE FLOW visibility into Routex.' },
          { view:'proof', selector:'#primaryAction', title:'Proof center', body:'Proof stores photos and service evidence and helps turn field work into client-safe deliverables.' },
          { view:'export', selector:'#ex_json', title:'Export center', body:'Backups, proof packets, route packs, task exports, and recovery artifacts all live here.' },
          { view:'settings', selector:'#st_backup', title:'Settings and controls', body:'Settings is the local-control lane: backup, validation, packs, walkthroughs, hybrid mode, and device safeguards.' }
        ]
      },
      {
        id: 'route-ops',
        title: 'Route ops • Build, run, close',
        description: 'Covers route build, route detail, service proof, and route-pack portability.',
        covers: ['route-list','route-detail','proof-center','route-pack'],
        steps: [
          { view:'routes', title:'Routes list', body:'Operators manage active route inventory here and can see status, quality, timing, and economics.' },
          { view:'routes', selector:'#primaryAction', title:'Create a route shell', body:'The Routes primary button is the fastest path to a new route shell before stops and service detail are added.' },
          { view:'routes-detail', title:'Route detail', body:'If a route exists, the tutorial lands in the first one. This is where stop detail, mileage, notes, materials, and closeout are handled.' },
          { view:'proof', selector:'#nsf_proof', title:'Service proof capture', body:'The proof lane follows route execution. This is where the operator turns execution into proof artifacts.' },
          { view:'export', selector:'#ex_route_pack', title:'Route-pack export', body:'Route packs make the route lane portable and reusable across devices or handoff flows.' },
          { view:'export', selector:'#ex_route_pack_import', title:'Route-pack import', body:'Import is the recovery and transfer side of the same route-pack story.' }
        ]
      },
      {
        id: 'artifact-mastery',
        title: 'Artifact mastery • Proof, packets, exports',
        description: 'Dedicated pass for the proof and artifact surfaces so operators understand what leaves the app and why.',
        covers: ['proof-center','proof-packets','closure-export','route-pack','recovery-import'],
        steps: [
          { view:'proof', selector:'#nsf_proof', title:'Proof surface', body:'This is the immediate proof lane for service evidence, proof bundles, and close-ready field support.' },
          { view:'export', selector:'#ex_packet', title:'Proof packet export', body:'Proof packets are the clean client-facing artifact lane. The tutorial lands on the real export control.' },
          { view:'export', selector:'#pv_export_closure', title:'Closure export', body:'Closure exports pull operational evidence into a package the operator can review or move.' },
          { view:'export', selector:'#ex_route_pack', title:'Portable route pack', body:'Portable route packs preserve work state for recovery and transfer instead of trapping it in one surface.' },
          { view:'export', selector:'#ex_import', title:'Import and restore', body:'Import is part of transparency too. The product teaches how artifacts return into the build, not only how they leave it.' }
        ]
      },
      {
        id: 'readiness-stack',
        title: 'Readiness stack • Launch board, walkthrough, binder',
        description: 'Shows how the app explains readiness through completion center, walkthrough receipt, and final binder.',
        covers: ['completion-center','human-walkthrough','completion-binder','launch-board'],
        steps: [
          { view:'dashboard', selector:'#routexLaunchBoardCard', title:'Operator launch board', body:'The launch board makes readiness visible with score, blockers, and next-action queue instead of forcing the operator to infer it.' },
          { view:'settings', selector:'#st_completion_center', title:'Completion center', body:'Completion center is the closure summary lane. It tells the operator what proof surfaces are passing and what still needs attention.' },
          { view:'settings', selector:'#st_human_walkthrough', title:'Human walkthrough manager', body:'This is the guided walkthrough closeout lane where the operator records the real no-dead walkthrough evidence.' },
          { view:'settings', selector:'#walk_binder_save', before: async ()=>{ try{ document.querySelector('#st_human_walkthrough')?.click(); }catch(_){} await wait(180); }, title:'Completion binder', body:'The binder packages the walkthrough receipt, compare state, attestation, and no-dead evidence into one sync-ready closeout artifact.' }
        ]
      },
      {
        id: 'hybrid-sync',
        title: 'Hybrid sync • Queues, sync, transparency',
        description: 'Focused pass for optional hybrid sync controls and queue hygiene.',
        covers: ['hybrid-sync','queue-clearance','device-attestation'],
        steps: [
          { view:'settings', selector:'#st_optional_hybrid', title:'Optional hybrid bundle', body:'Hybrid mode is optional and visible. The tutorial lands on the live launcher so the user knows where sync controls begin.' },
          { view:'settings', selector:'#hy_sync', before: async ()=>{ try{ document.querySelector('#st_optional_hybrid')?.click(); }catch(_){} await wait(180); }, title:'Hybrid sync action', body:'This is the manual sync control for hybrid state movement.' },
          { view:'settings', selector:'#hy_queue_sync', before: async ()=>{ try{ document.querySelector('#st_optional_hybrid')?.click(); }catch(_){} await wait(180); }, title:'Queue sync', body:'Queued items are visible and manageable instead of hidden. This is part of product transparency.' },
          { view:'settings', selector:'#hy_clear_sync_queue', before: async ()=>{ try{ document.querySelector('#st_optional_hybrid')?.click(); }catch(_){} await wait(180); }, title:'Queue clearance', body:'The queue clear action is taught inside the product so stale sync state does not become mysterious.' }
        ]
      },
      {
        id: 'lineage-transfer',
        title: 'Lineage and transfer proof',
        description: 'Covers legacy intake, transfer capsules, and cross-surface portability controls.',
        covers: ['legacy-proof','transfer-proof','capsules','cross-device'],
        steps: [
          { view:'settings', selector:'#st_legacy_intake', title:'Legacy intake', body:'Legacy intake is the lineage lane. This is where older proof and restore comparisons start.' },
          { view:'settings', selector:'#st_cross_device_capsules', title:'Cross-device capsules', body:'Capsules are the portable transfer-proof lane for shared artifacts and staged reopen flows.' },
          { view:'export', selector:'#ex_route_pack_import', title:'Transfer import', body:'The import lane is part of transfer proof because it shows where portable artifacts re-enter the product.' },
          { view:'settings', selector:'#st_trip_packs', title:'Trip-pack coverage', body:'Trip packs are part of the portable evidence story and are taught directly in the settings control lane.' }
        ]
      },
      {
        id: 'security-recovery',
        title: 'Security and recovery',
        description: 'Covers PIN gate, backup, encrypted backup, import, and wipe controls.',
        covers: ['pin-gate','backups','encrypted-backup','recovery-import','wipe'],
        steps: [
          { view:'settings', selector:'#st_pin1', title:'Local PIN gate', body:'The PIN gate is device-local security for offline deployments and vault-style usage.' },
          { view:'settings', selector:'#st_backup', title:'Fast backup launch', body:'The backup launcher points operators toward export and recovery before destructive actions.' },
          { view:'export', selector:'#ex_json_enc', title:'Encrypted backup', body:'Encrypted backup is the strongest current offline recovery artifact when proof and photos matter.' },
          { view:'export', selector:'#ex_import', title:'Import and restore', body:'Import is part of the recovery lane and must be taught alongside backup.' },
          { view:'settings', selector:'#st_wipe', title:'Destructive actions stay last', body:'The walkthrough ends on wipe intentionally so the product teaches recovery before destruction.' }
        ]
      },
      {
        id: 'bridge-and-packs',
        title: 'Bridge and packs • AE FLOW to Routex',
        description: 'Shows how Routex receives AE FLOW seeds and portable pack support.',
        covers: ['aeflow-bridge','pack-seeds','trip-packs'],
        steps: [
          { view:'routes', selector:'#routesOpenAEFlow', title:'AE FLOW bridge entry', body:'The bridge control is where Routex can pull working visibility from AE FLOW instead of staying isolated.' },
          { view:'settings', selector:'#st_ae_pack_seeds', title:'AE pack seeds', body:'Pack seeds let the bridge create portable working units rather than one-off transfers.' },
          { view:'settings', selector:'#st_trip_packs', title:'Trip packs', body:'Trip packs support reusable service and territory packaging inside the Routex side of the product.' }
        ]
      }
    ];
  }

  function getTour(id){ return getTours().find(t => t.id === id) || null; }

  function getCoverageItems(){
    return [
      { id:'dashboard', label:'Dashboard and command center', tours:['start-here'] },
      { id:'route-creation', label:'Route creation', tours:['start-here'] },
      { id:'route-list', label:'Route list and route detail', tours:['start-here','route-ops'] },
      { id:'proof-center', label:'Proof center', tours:['start-here','route-ops','artifact-mastery'] },
      { id:'proof-packets', label:'Proof packets and closure export', tours:['artifact-mastery'] },
      { id:'route-pack', label:'Route-pack export and import', tours:['route-ops','artifact-mastery'] },
      { id:'completion-center', label:'Completion center', tours:['readiness-stack'] },
      { id:'human-walkthrough', label:'Human walkthrough manager', tours:['readiness-stack'] },
      { id:'completion-binder', label:'Completion binder', tours:['readiness-stack'] },
      { id:'launch-board', label:'Operator launch board', tours:['readiness-stack'] },
      { id:'hybrid-sync', label:'Hybrid sync and queues', tours:['hybrid-sync'] },
      { id:'legacy-proof', label:'Legacy intake and lineage proof', tours:['lineage-transfer'] },
      { id:'transfer-proof', label:'Transfer and capsule proof', tours:['lineage-transfer'] },
      { id:'pin-gate', label:'PIN gate and recovery', tours:['security-recovery'] },
      { id:'backups', label:'Backups and encrypted backups', tours:['security-recovery'] },
      { id:'aeflow-bridge', label:'AE FLOW bridge and pack seeds', tours:['bridge-and-packs'] }
    ];
  }

  function completedCount(){
    const progress = readProgress();
    return getTours().filter(t => progress[t.id] && progress[t.id].completedAt).length;
  }

  function recommendedTourIds(){
    const progress = readProgress();
    const ids = [];
    ['start-here','route-ops','artifact-mastery','readiness-stack','hybrid-sync','lineage-transfer','security-recovery','bridge-and-packs'].forEach(id => {
      if(!(progress[id] && progress[id].completedAt)) ids.push(id);
    });
    return ids.length ? ids : getTours().map(t => t.id);
  }

  async function gotoView(viewId){
    if(!window.APP) return true;
    if(viewId === 'routes-detail'){
      if(Array.isArray(APP.cached && APP.cached.routes) && APP.cached.routes.length){
        APP.routeId = APP.cached.routes[0].id;
        APP.view = 'routes';
        window.location.hash = 'routes';
        await window.render();
        await wait(180);
        return true;
      }
      viewId = 'routes';
    }
    if(viewId === 'routes') APP.routeId = null;
    if(APP.view !== viewId || (viewId === 'routes' && APP.routeId)){
      APP.view = viewId;
      window.location.hash = viewId;
      await window.render();
      await wait(180);
      return true;
    }
    await wait(80);
    return true;
  }

  function clearTarget(){
    if(activeTarget){
      activeTarget.classList.remove('tour-active-target');
      activeTarget = null;
    }
  }

  function ensureStyle(){
    if(document.getElementById('routexTutorialStylesV36')) return;
    const style = document.createElement('style');
    style.id = 'routexTutorialStylesV36';
    style.textContent = `
      .tour-active-target{
        position: relative !important;
        z-index: 10002 !important;
        box-shadow: 0 0 0 3px rgba(245,197,66,.92), 0 0 0 9999px rgba(3,1,8,.58) !important;
        border-radius: 16px !important;
      }
      .rtx-tour-overlay{ position: fixed; inset: 0; z-index: 10001; pointer-events: none; }
      .rtx-tour-dock{
        position: fixed; right: 18px; bottom: 18px; width: min(440px, calc(100vw - 28px));
        border: 1px solid rgba(255,255,255,.16); border-radius: 20px;
        background: linear-gradient(180deg, rgba(18,8,32,.96), rgba(8,3,16,.94));
        box-shadow: 0 28px 80px rgba(0,0,0,.52); padding: 16px; color: rgba(255,255,255,.94); pointer-events: auto;
      }
      .rtx-tour-kicker{ display:flex; align-items:center; gap:8px; font-size:11px; letter-spacing:.18em; text-transform:uppercase; color: rgba(245,197,66,.88); margin-bottom:8px; }
      .rtx-tour-title{ font-size: 19px; font-weight: 900; margin: 0 0 6px; }
      .rtx-tour-body{ font-size: 13px; line-height: 1.5; color: rgba(255,255,255,.80); white-space: pre-wrap; }
      .rtx-tour-progress{ height: 7px; border-radius: 999px; background: rgba(255,255,255,.10); overflow: hidden; margin: 14px 0 12px; }
      .rtx-tour-progress > i{ display:block; height:100%; width:0; background: linear-gradient(90deg, rgba(245,197,66,.95), rgba(168,85,247,.92)); }
      .rtx-tour-grid{ display:grid; grid-template-columns: repeat(auto-fit, minmax(220px,1fr)); gap: 10px; margin-top: 12px; }
      .rtx-tour-tile{ border:1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.04); border-radius: 16px; padding: 12px; }
      .rtx-tour-tile h4{ margin: 0 0 6px; font-size: 14px; }
      .rtx-tour-tile p{ margin: 0 0 10px; color: rgba(255,255,255,.72); font-size: 12px; line-height: 1.45; }
      .rtx-tour-mini{ font-size: 11px; color: rgba(255,255,255,.62); }
      .rtx-tour-coverage{ width:100%; border-collapse:collapse; margin-top:12px; }
      .rtx-tour-coverage th, .rtx-tour-coverage td{ padding:8px; border-bottom:1px solid rgba(255,255,255,.08); text-align:left; vertical-align:top; font-size:12px; }
      .rtx-help-launch{ margin-left:8px; }
    `;
    document.head.appendChild(style);
  }

  function ensureOverlay(){
    ensureStyle();
    if(overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'rtx-tour-overlay hidden';
    overlay.id = 'rtxTourOverlay';
    overlay.innerHTML = `
      <div class="rtx-tour-dock">
        <div class="rtx-tour-kicker"><span>Interactive walkthrough</span><span id="rtxTourStepMeta" class="rtx-tour-chip">Step 1 / 1</span></div>
        <h3 class="rtx-tour-title" id="rtxTourTitle">Routex walkthrough</h3>
        <div class="rtx-tour-body" id="rtxTourBody"></div>
        <div class="rtx-tour-progress"><i id="rtxTourProgressBar"></i></div>
        <div class="rtx-tour-actions">
          <button class="btn small" id="rtxTourBackBtn" type="button">Back</button>
          <button class="btn small" id="rtxTourNextBtn" type="button">Next</button>
          <div class="grow"></div>
          <button class="btn small" id="rtxTourHubBtn" type="button">Tour center</button>
          <button class="btn small danger" id="rtxTourCloseBtn" type="button">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('rtxTourBackBtn').onclick = ()=> moveStep(-1);
    document.getElementById('rtxTourNextBtn').onclick = ()=> moveStep(1);
    document.getElementById('rtxTourCloseBtn').onclick = ()=> closeTour('stopped');
    document.getElementById('rtxTourHubBtn').onclick = ()=> openTutorialCenter();
    return overlay;
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

  async function highlightStep(step){
    clearTarget();
    const target = await resolveTarget(step || {});
    if(target){
      activeTarget = target;
      activeTarget.classList.add('tour-active-target');
      if(activeTarget.scrollIntoView){
        activeTarget.scrollIntoView({ behavior:'smooth', block:'center', inline:'center' });
      }
    }
  }

  function getTourStatusText(tour, row){
    if(row && row.completedAt) return 'Completed';
    if(row && row.lastStep) return 'Last step ' + row.lastStep + '/' + tour.steps.length;
    return 'Not started';
  }

  async function applyStep(){
    if(!activeTourState) return;
    const tour = getTour(activeTourState.tourId);
    if(!tour) return;
    const step = tour.steps[activeTourState.stepIndex];
    if(!step) return;
    closeAnyModal();
    if(step.view) await gotoView(step.view);
    if(typeof step.before === 'function'){
      try{ await step.before(); }catch(_){}
    }
    await highlightStep(step);
    ensureOverlay();
    overlay.classList.remove('hidden');
    document.getElementById('rtxTourTitle').textContent = step.title || tour.title;
    document.getElementById('rtxTourBody').textContent = step.body || '';
    document.getElementById('rtxTourStepMeta').textContent = 'Step ' + (activeTourState.stepIndex + 1) + ' / ' + tour.steps.length;
    document.getElementById('rtxTourProgressBar').style.width = (((activeTourState.stepIndex + 1) / tour.steps.length) * 100).toFixed(1) + '%';
    document.getElementById('rtxTourBackBtn').disabled = activeTourState.stepIndex === 0;
    document.getElementById('rtxTourNextBtn').textContent = activeTourState.stepIndex === tour.steps.length - 1 ? 'Finish' : 'Next';
    markProgress(activeTourState.tourId, { lastStep: activeTourState.stepIndex + 1, inProgress: true });
    saveCenterState({ lastOpenedTour: activeTourState.tourId });
    injectEntryPoints();
  }

  async function moveStep(delta){
    if(!activeTourState) return;
    const tour = getTour(activeTourState.tourId);
    if(!tour) return;
    const nextIndex = activeTourState.stepIndex + delta;
    if(nextIndex < 0) return;
    if(nextIndex >= tour.steps.length){
      markProgress(activeTourState.tourId, { completedAt: new Date().toISOString(), inProgress: false, lastStep: tour.steps.length });
      const queue = Array.isArray(activeTourState.queue) ? activeTourState.queue.slice() : [];
      if(activeTourState.mode === 'recommended' && queue.length === 0){
        saveOnboarding({ completedAt: new Date().toISOString() });
      }
      closeTour('completed', false);
      toast('Walkthrough completed.', 'good');
      if(queue.length){
        await wait(180);
        startTour(queue[0], queue.slice(1), activeTourState.mode || '');
      }else{
        openTutorialCenter();
      }
      return;
    }
    activeTourState.stepIndex = nextIndex;
    await applyStep();
  }

  function closeTour(reason, reopenCenter){
    clearTarget();
    if(overlay) overlay.classList.add('hidden');
    if(activeTourState){
      markProgress(activeTourState.tourId, { inProgress: false, lastClosedReason: reason || 'closed' });
    }
    activeTourState = null;
    if(reopenCenter){
      setTimeout(()=> openTutorialCenter(), 80);
    }
    injectEntryPoints();
  }

  function startTour(tourId, queue, mode){
    const tour = getTour(tourId);
    if(!tour) return;
    closeAnyModal();
    activeTourState = { tourId, stepIndex: 0, queue: Array.isArray(queue) ? queue : [], mode: clean(mode) || 'single' };
    applyStep();
  }

  function startAllTours(){
    const ids = getTours().map(t => t.id);
    if(!ids.length) return;
    startTour(ids[0], ids.slice(1), 'all');
  }

  function startRecommendedOnboarding(){
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
      const recommended = mappedTours[0] || null;
      return `<tr>
        <td>${esc(item.label)}</td>
        <td>${completed ? 'Covered' : 'Needs run'}</td>
        <td>${mappedTours.map(t => esc(t.title)).join('<br/>') || '—'}</td>
        <td>${recommended ? `<button class="btn small" data-rtx-tour="${esc(recommended.id)}">Guide me</button>` : '—'}</td>
      </tr>`;
    }).join('');
    return `<table class="rtx-tour-coverage"><thead><tr><th>Product area</th><th>Status</th><th>Walkthrough coverage</th><th>Launch</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function tutorialCenterHtml(){
    const progress = readProgress();
    const tours = getTours();
    const done = tours.filter(t => progress[t.id] && progress[t.id].completedAt).length;
    const percent = tours.length ? Math.round((done / tours.length) * 100) : 0;
    return `
      <div class="hint">This is a real tutorial center. Starting a walkthrough moves the user through live screens, opens the controls they need, and explains why that lane matters.</div>
      <div class="sep"></div>
      <div class="row" style="flex-wrap:wrap;">
        <div class="pill">${done}/${tours.length} walkthroughs completed</div>
        <div class="pill">Product education coverage ${percent}%</div>
        <button class="btn" id="rtxTourStartRecommendedBtn">Run recommended onboarding</button>
        <button class="btn" id="rtxTourStartAllBtn">Run all walkthroughs</button>
        <button class="btn" id="rtxTourResetBtn">Reset progress</button>
      </div>
      <div class="sep"></div>
      <h3 style="margin:0 0 8px;">Coverage matrix</h3>
      ${coverageMatrixHtml()}
      <div class="sep"></div>
      <div class="rtx-tour-grid">
        ${tours.map(t => {
          const row = progress[t.id] || {};
          return `<div class="rtx-tour-tile">
            <h4>${esc(t.title)}</h4>
            <p>${esc(t.description)}</p>
            <div class="rtx-tour-mini">${getTourStatusText(t, row)} • Covers ${t.covers.length} product area(s)</div>
            <div class="sep"></div>
            <div class="row" style="flex-wrap:wrap;">
              <button class="btn small" data-rtx-tour="${esc(t.id)}">Start walkthrough</button>
            </div>
          </div>`;
        }).join('')}
      </div>
    `;
  }

  function bindTutorialCenter(){
    const recBtn = document.getElementById('rtxTourStartRecommendedBtn');
    if(recBtn) recBtn.onclick = ()=>{ closeAnyModal(); startRecommendedOnboarding(); };
    const allBtn = document.getElementById('rtxTourStartAllBtn');
    if(allBtn) allBtn.onclick = ()=>{ closeAnyModal(); startAllTours(); };
    const resetBtn = document.getElementById('rtxTourResetBtn');
    if(resetBtn) resetBtn.onclick = ()=>{
      saveProgress({});
      saveOnboarding({ startedAt:'', completedAt:'', dismissedAt:'' });
      toast('Walkthrough progress reset.', 'good');
      openTutorialCenter();
      injectEntryPoints();
    };
    document.querySelectorAll('[data-rtx-tour]').forEach(btn => {
      btn.onclick = ()=>{ closeAnyModal(); startTour(btn.getAttribute('data-rtx-tour')); };
    });
  }

  function openTutorialCenter(){
    if(typeof window.openModal === 'function'){
      window.openModal(
        'Interactive walkthroughs',
        tutorialCenterHtml(),
        `<button class="btn" onclick="document.getElementById('modalClose').click()">Close</button>`
      );
      bindTutorialCenter();
      saveCenterState({ seenAt: new Date().toISOString() });
    }
  }

  function maybePromptOnboarding(){
    if(onboardingPrompted) return;
    onboardingPrompted = true;
    const progress = readProgress();
    if(Object.keys(progress).length) return;
    const state = readOnboarding();
    if(state.dismissedAt || state.completedAt || state.startedAt) return;
    if(typeof window.openModal !== 'function') return;
    setTimeout(()=>{
      if(activeTourState) return;
      window.openModal(
        'Start guided onboarding',
        `<div class="hint">Routex now includes screen-changing product education. The recommended onboarding runs the key walkthroughs in order so a new user can learn the app without guessing.</div>
         <div class="sep"></div>
         <div class="row" style="flex-wrap:wrap;">
           <button class="btn" id="rtxOnboardingStartBtn">Start recommended onboarding</button>
           <button class="btn" id="rtxOnboardingCenterBtn">Open tutorial center</button>
           <button class="btn danger" id="rtxOnboardingDismissBtn">Not now</button>
         </div>`,
        `<button class="btn" onclick="document.getElementById('modalClose').click()">Close</button>`
      );
      document.getElementById('rtxOnboardingStartBtn')?.addEventListener('click', ()=>{ saveOnboarding({ promptedAt:new Date().toISOString() }); closeAnyModal(); startRecommendedOnboarding(); });
      document.getElementById('rtxOnboardingCenterBtn')?.addEventListener('click', ()=>{ saveOnboarding({ promptedAt:new Date().toISOString() }); closeAnyModal(); openTutorialCenter(); });
      document.getElementById('rtxOnboardingDismissBtn')?.addEventListener('click', ()=>{ saveOnboarding({ promptedAt:new Date().toISOString(), dismissedAt:new Date().toISOString() }); closeAnyModal(); });
    }, 600);
  }

  function dashboardLaunchpadCard(){
    const done = completedCount();
    const total = getTours().length;
    const nextTour = recommendedTourIds()[0];
    const nextLabel = getTour(nextTour) ? getTour(nextTour).title : 'Recommended onboarding';
    return `
      <h2>Interactive walkthrough launchpad</h2>
      <div class="hint">Routex now teaches itself in-product. Walkthroughs move through real screens, open live controls, and explain the actual lane the user is on.</div>
      <div class="sep"></div>
      <div class="row" style="flex-wrap:wrap;">
        <div class="pill">${done}/${total} walkthroughs completed</div>
        <div class="pill">Next recommended: ${esc(nextLabel)}</div>
        <button class="btn" id="rtxDashToursHub">Open tutorial center</button>
        <button class="btn" id="rtxDashToursRecommended">Run recommended onboarding</button>
        <button class="btn" id="rtxDashToursAll">Run all walkthroughs</button>
      </div>
    `;
  }

  function settingsTutorialCard(){
    const progress = readProgress();
    const total = getTours().length;
    const done = completedCount();
    const last = Object.entries(progress).sort((a,b)=> String((b[1]||{}).updatedAt || '').localeCompare(String((a[1]||{}).updatedAt || '')))[0];
    const lastText = last ? (getTour(last[0]) ? getTour(last[0]).title : last[0]) : 'No walkthrough run yet';
    return `
      <h2>Walkthrough & tutorial center</h2>
      <div class="hint">These are guided screen-changing walkthroughs. The app moves through the areas the operator actually uses instead of leaving them with detached written notes.</div>
      <div class="sep"></div>
      <div class="row" style="flex-wrap:wrap;">
        <div class="pill">${done}/${total} completed</div>
        <div class="pill">Last touched: ${esc(lastText)}</div>
        <button class="btn" id="rtxSettingsToursHub">Open tutorial center</button>
        <button class="btn" id="rtxSettingsToursRecommended">Run recommended onboarding</button>
        <button class="btn" id="rtxSettingsToursAll">Run every walkthrough</button>
      </div>
    `;
  }

  function bindEntryPointButtons(){
    ['rtxTopbarToursBtn', 'rtxDashToursHub', 'rtxSettingsToursHub'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.onclick = openTutorialCenter;
    });
    ['rtxDashToursAll', 'rtxSettingsToursAll'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.onclick = ()=> startAllTours();
    });
    ['rtxDashToursRecommended', 'rtxSettingsToursRecommended'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.onclick = ()=> startRecommendedOnboarding();
    });
  }

  function injectTopbarButton(){
    const host = document.querySelector('.topbar .row:last-of-type') || document.querySelector('.topbar .row');
    if(host && !document.getElementById('rtxTopbarToursBtn')){
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.id = 'rtxTopbarToursBtn';
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>Tours';
      host.insertBefore(btn, host.firstChild);
      btn.onclick = openTutorialCenter;
    }
  }

  function injectDashboardCard(){
    if(!(window.APP && APP.view === 'dashboard')) return;
    const grid = document.querySelector('#content .grid');
    if(grid && !document.getElementById('rtxTutorialLaunchpadCard')){
      const card = document.createElement('div');
      card.className = 'card';
      card.id = 'rtxTutorialLaunchpadCard';
      card.style.gridColumn = 'span 12';
      card.innerHTML = dashboardLaunchpadCard();
      grid.insertBefore(card, grid.firstChild);
      bindEntryPointButtons();
    }
  }

  function injectSettingsCard(){
    if(!(window.APP && APP.view === 'settings')) return;
    const grid = document.querySelector('#content .grid');
    if(grid && !document.getElementById('rtxTutorialSettingsCard')){
      const card = document.createElement('div');
      card.className = 'card';
      card.id = 'rtxTutorialSettingsCard';
      card.style.gridColumn = 'span 12';
      card.innerHTML = settingsTutorialCard();
      grid.insertBefore(card, grid.firstChild);
      bindEntryPointButtons();
    }
  }

  function attachLauncherAfter(target, id, label, handler){
    if(!target || document.getElementById(id)) return;
    const btn = document.createElement('button');
    btn.className = 'btn small rtx-help-launch';
    btn.id = id;
    btn.type = 'button';
    btn.textContent = label;
    btn.onclick = handler;
    target.insertAdjacentElement('afterend', btn);
  }

  function injectContextualHelp(){
    const specs = [
      { selector:'#routexLaunchBoardCard', id:'rtxHelpLaunchBoard', label:'Launch board guide', tour:'readiness-stack' },
      { selector:'#st_completion_center', id:'rtxHelpCompletionCenter', label:'Guide', tour:'readiness-stack' },
      { selector:'#st_human_walkthrough', id:'rtxHelpWalkthrough', label:'Guide', tour:'readiness-stack' },
      { selector:'#st_optional_hybrid', id:'rtxHelpHybrid', label:'Guide', tour:'hybrid-sync' },
      { selector:'#st_legacy_intake', id:'rtxHelpLegacy', label:'Guide', tour:'lineage-transfer' },
      { selector:'#st_cross_device_capsules', id:'rtxHelpCapsules', label:'Guide', tour:'lineage-transfer' },
      { selector:'#st_ae_pack_seeds', id:'rtxHelpPackSeeds', label:'Guide', tour:'bridge-and-packs' },
      { selector:'#st_trip_packs', id:'rtxHelpTripPacks', label:'Guide', tour:'bridge-and-packs' },
      { selector:'#st_backup', id:'rtxHelpBackup', label:'Guide', tour:'security-recovery' },
      { selector:'#ex_route_pack', id:'rtxHelpRoutePack', label:'Guide', tour:'artifact-mastery' },
      { selector:'#ex_import', id:'rtxHelpImport', label:'Guide', tour:'artifact-mastery' },
      { selector:'#routesOpenAEFlow', id:'rtxHelpAEBridge', label:'Guide', tour:'bridge-and-packs' }
    ];
    specs.forEach(spec => {
      const target = document.querySelector(spec.selector);
      if(target){
        attachLauncherAfter(target, spec.id, spec.label, ()=> startTour(spec.tour));
      }
    });
  }

  function injectEntryPoints(){
    injectTopbarButton();
    injectDashboardCard();
    injectSettingsCard();
    injectContextualHelp();
    bindEntryPointButtons();
  }

  const observer = new MutationObserver(()=> injectEntryPoints());
  observer.observe(document.documentElement || document.body, { childList:true, subtree:true });

  const prevRender = window.render;
  if(typeof prevRender === 'function'){
    window.render = async function(){
      const out = await prevRender.apply(this, arguments);
      setTimeout(()=>{ injectEntryPoints(); maybePromptOnboarding(); }, 0);
      return out;
    };
  }

  window.openRoutexTutorialCenter = openTutorialCenter;
  window.startRoutexInteractiveTour = startTour;
  window.startRoutexRecommendedOnboarding = startRecommendedOnboarding;

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ()=> setTimeout(()=>{ injectEntryPoints(); maybePromptOnboarding(); }, 150));
  }else{
    setTimeout(()=>{ injectEntryPoints(); maybePromptOnboarding(); }, 150);
  }
})();


/* V37 Routex academy add-on: role packs, micro guides, analytics heatmap, inline explainers */
(function(){
  if(window.__ROUTEX_V37_ACADEMY__) return;
  window.__ROUTEX_V37_ACADEMY__ = true;

  const FULL_PROGRESS_KEY = 'skye_routex_tutorial_progress_v2';
  const MINI_PROGRESS_KEY = 'skye_routex_mini_progress_v1';
  const toast = window.toast || function(){};
  const wait = (ms)=> new Promise(resolve => setTimeout(resolve, ms));
  const esc = (v)=> String(v == null ? '' : v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const clean = (v)=> String(v == null ? '' : v).trim();
  let pendingExplainer = null;
  let overlay = null;
  let active = null;
  let activeTarget = null;

  function readJSON(key, fallback){
    try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; }
  }
  function writeJSON(key, value){
    try{ localStorage.setItem(key, JSON.stringify(value)); }catch(_){}
    return value;
  }
  function readFull(){ return readJSON(FULL_PROGRESS_KEY, {}); }
  function readMini(){ return readJSON(MINI_PROGRESS_KEY, {}); }
  function saveMini(next){ return writeJSON(MINI_PROGRESS_KEY, next || {}); }
  function markMini(id, patch){
    const next = readMini();
    next[id] = Object.assign({}, next[id] || {}, patch || {}, { updatedAt: new Date().toISOString() });
    saveMini(next);
    return next[id];
  }
  function latestRows(){
    const rows = [];
    const full = readFull();
    Object.entries(full).forEach(([id,row])=> rows.push({kind:'Tour', id, title:id, updatedAt:String((row||{}).updatedAt||''), done:!!(row&&row.completedAt)}));
    const mini = readMini();
    Object.entries(mini).forEach(([id,row])=> rows.push({kind:'Micro', id, title:id, updatedAt:String((row||{}).updatedAt||''), done:!!(row&&row.completedAt)}));
    return rows.filter(r=>r.updatedAt).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,8);
  }
  function gotoView(viewId){
    return (async ()=>{
      if(!window.APP) return true;
      if(viewId === 'routes-detail'){
        if(Array.isArray(APP.cached && APP.cached.routes) && APP.cached.routes.length){
          APP.routeId = APP.cached.routes[0].id;
          APP.view = 'routes';
          window.location.hash = 'routes';
          if(typeof window.render === 'function') await window.render();
          await wait(140);
          return true;
        }
        viewId = 'routes';
      }
      if(viewId === 'routes') APP.routeId = null;
      if(APP.view !== viewId || (viewId === 'routes' && APP.routeId)){
        APP.view = viewId;
        window.location.hash = viewId;
        if(typeof window.render === 'function') await window.render();
        await wait(140);
      }
      return true;
    })();
  }
  function ensureStyle(){
    if(document.getElementById('routexAcademyV37Styles')) return;
    const style = document.createElement('style');
    style.id = 'routexAcademyV37Styles';
    style.textContent = `
      .rtx-academy-btn{ margin-left:8px; }
      .rtx-academy-target{ position:relative !important; z-index:10012 !important; box-shadow:0 0 0 3px rgba(245,197,66,.95),0 0 0 9999px rgba(5,2,12,.56) !important; border-radius:16px !important; }
      .rtx-academy-overlay{ position:fixed; inset:0; z-index:10011; pointer-events:none; }
      .rtx-academy-dock{ position:fixed; left:18px; bottom:18px; width:min(420px, calc(100vw - 28px)); border:1px solid rgba(255,255,255,.14); border-radius:20px; background:linear-gradient(180deg, rgba(22,9,40,.97), rgba(9,4,18,.95)); box-shadow:0 28px 80px rgba(0,0,0,.52); padding:16px; color:#fff; pointer-events:auto; }
      .rtx-academy-dock h3{ margin:0 0 8px; font-size:18px; font-weight:900; }
      .rtx-academy-dock p{ margin:0; font-size:13px; line-height:1.5; color:rgba(255,255,255,.82); white-space:pre-wrap; }
      .rtx-academy-bar{ height:7px; border-radius:999px; background:rgba(255,255,255,.10); overflow:hidden; margin:12px 0; }
      .rtx-academy-bar > i{ display:block; height:100%; width:0; background:linear-gradient(90deg, rgba(245,197,66,.95), rgba(168,85,247,.92)); }
      .rtx-academy-grid{ display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:10px; margin-top:12px; }
      .rtx-academy-card{ border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.04); border-radius:16px; padding:12px; }
      .rtx-academy-card h4{ margin:0 0 6px; font-size:14px; }
      .rtx-academy-card p{ margin:0 0 8px; font-size:12px; line-height:1.45; color:rgba(255,255,255,.72); }
      .rtx-academy-mini{ font-size:11px; color:rgba(255,255,255,.62); }
      .rtx-academy-table{ width:100%; border-collapse:collapse; margin-top:12px; }
      .rtx-academy-table th,.rtx-academy-table td{ padding:8px; border-bottom:1px solid rgba(255,255,255,.08); text-align:left; vertical-align:top; font-size:12px; }
      .rtx-academy-heat{ display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:10px; margin-top:12px; }
      .rtx-academy-heatcell{ border-radius:14px; padding:10px; border:1px solid rgba(255,255,255,.10); }
      .rtx-academy-heatcell.ok{ background:rgba(16,185,129,.14); }
      .rtx-academy-heatcell.warn{ background:rgba(245,158,11,.14); }
      .rtx-academy-heatcell h5{ margin:0 0 4px; font-size:12px; }
      .rtx-academy-explainer{ margin:0 0 12px; padding:12px; border-radius:14px; border:1px solid rgba(245,197,66,.25); background:rgba(245,197,66,.08); }
      .rtx-academy-explainer h4{ margin:0 0 6px; font-size:13px; letter-spacing:.02em; }
      .rtx-academy-explainer p{ margin:0 0 10px; font-size:12px; color:rgba(255,255,255,.82); line-height:1.45; }
    `;
    document.head.appendChild(style);
  }
  function getMiniGuides(){
    return [
      {
        id:'mini-launch-board',
        title:'Micro guide • Launch board',
        description:'Fast read of readiness score, blockers, and next-action queue.',
        steps:[
          { view:'dashboard', selector:'#routexLaunchBoardCard', title:'Launch board card', body:'This card is the fastest readiness read in Routex. It compresses the proof stack, handoff stack, and queue pressure into one visible signal.' },
          { view:'dashboard', selector:'#routexLaunchBoardSaveBtn', title:'Save launch board', body:'Saving the board fingerprints the current operational state so AE FLOW and external review do not rely on memory.' }
        ]
      },
      {
        id:'mini-completion-binder',
        title:'Micro guide • Completion binder',
        description:'Short guided pass for walkthrough receipt and final binder export.',
        steps:[
          { view:'settings', selector:'#st_human_walkthrough', title:'Human walkthrough lane', body:'This is where the real no-dead walkthrough proof is recorded instead of only implied.' },
          { view:'settings', selector:'#walk_binder_save', before: async ()=>{ try{ document.querySelector('#st_human_walkthrough')?.click(); }catch(_){} await wait(160); }, title:'Save completion binder', body:'The completion binder packages the walkthrough receipt, compare state, attestation, and closeout evidence into one closure artifact.' }
        ]
      },
      {
        id:'mini-hybrid-queue',
        title:'Micro guide • Hybrid queue hygiene',
        description:'Quick pass for queue sync, export, and cleanup.',
        steps:[
          { view:'settings', selector:'#st_optional_hybrid', title:'Hybrid bundle', body:'Hybrid mode is optional. This guide shows the specific queue controls so the lane is transparent.' },
          { view:'settings', selector:'#hy_queue_sync', before: async ()=>{ try{ document.querySelector('#st_optional_hybrid')?.click(); }catch(_){} await wait(160); }, title:'Queue sync', body:'Queue sync is the first active control when you want to move pending hybrid items.' },
          { view:'settings', selector:'#hy_clear_sync_queue', before: async ()=>{ try{ document.querySelector('#st_optional_hybrid')?.click(); }catch(_){} await wait(160); }, title:'Clear stale queue state', body:'Clearance exists so stale sync rows are visible and removable instead of mysterious.' }
        ]
      },
      {
        id:'mini-import-restore',
        title:'Micro guide • Import and restore',
        description:'Shows the shortest path for recovery artifacts to re-enter the app.',
        steps:[
          { view:'export', selector:'#ex_import', title:'Import center', body:'Import is the recovery side of the product story. It is where portable artifacts return into the working surface.' },
          { view:'export', selector:'#ex_route_pack_import', title:'Route-pack import', body:'Route-pack import restores route state without making the operator rebuild the route manually.' }
        ]
      },
      {
        id:'mini-proof-packet',
        title:'Micro guide • Proof packet',
        description:'Fast pass for client-safe proof and closure exports.',
        steps:[
          { view:'proof', selector:'#nsf_proof', title:'Proof lane', body:'The proof lane is where field work becomes visible evidence.' },
          { view:'export', selector:'#ex_packet', title:'Proof packet export', body:'Proof packets are the fastest client-facing artifact lane when you want a clean portable deliverable.' },
          { view:'export', selector:'#pv_export_closure', title:'Closure export', body:'Closure export packages the proof side with closeout context for review and handoff.' }
        ]
      },
      {
        id:'mini-legacy-transfer',
        title:'Micro guide • Legacy and capsules',
        description:'Short proof of lineage, capsules, and portable recovery state.',
        steps:[
          { view:'settings', selector:'#st_legacy_intake', title:'Legacy intake', body:'Legacy intake keeps older package lineage visible instead of treating history like a black box.' },
          { view:'settings', selector:'#st_cross_device_capsules', title:'Cross-device capsules', body:'Capsules are portable proof units for staged reopen, compare, and device transfer flows.' }
        ]
      }
    ];
  }
  function getMiniGuide(id){ return getMiniGuides().find(g => g.id === id) || null; }
  function getRolePacks(){
    return [
      { id:'pack-operator', title:'Operator essentials pack', summary:'Start here, route ops, launch board, completion binder, and import safety.', guides:[['tour','start-here'],['tour','route-ops'],['mini','mini-launch-board'],['mini','mini-completion-binder'],['mini','mini-import-restore']] },
      { id:'pack-closeout', title:'Proof and closeout pack', summary:'Artifact mastery plus binder and packet micro-guides for proof-first closeout.', guides:[['tour','artifact-mastery'],['tour','readiness-stack'],['mini','mini-proof-packet'],['mini','mini-completion-binder']] },
      { id:'pack-recovery', title:'Recovery and trust pack', summary:'Security, hybrid queues, import, legacy, and capsules for trustworthy recovery.', guides:[['tour','security-recovery'],['tour','hybrid-sync'],['mini','mini-import-restore'],['mini','mini-hybrid-queue'],['mini','mini-legacy-transfer']] },
      { id:'pack-bridge', title:'Bridge and sync pack', summary:'AE FLOW bridge, pack seeds, hybrid sync, and lineage portability.', guides:[['tour','bridge-and-packs'],['tour','lineage-transfer'],['tour','hybrid-sync'],['mini','mini-legacy-transfer']] }
    ];
  }
  function coverageRows(){
    const full = readFull();
    const mini = readMini();
    return [
      { area:'Core navigation', ok: !!(full['start-here'] && full['start-here'].completedAt) },
      { area:'Route operations', ok: !!(full['route-ops'] && full['route-ops'].completedAt) },
      { area:'Proof and artifacts', ok: !!((full['artifact-mastery'] && full['artifact-mastery'].completedAt) || (mini['mini-proof-packet'] && mini['mini-proof-packet'].completedAt)) },
      { area:'Launch and closeout', ok: !!((full['readiness-stack'] && full['readiness-stack'].completedAt) || (mini['mini-launch-board'] && mini['mini-launch-board'].completedAt) || (mini['mini-completion-binder'] && mini['mini-completion-binder'].completedAt)) },
      { area:'Hybrid and queues', ok: !!((full['hybrid-sync'] && full['hybrid-sync'].completedAt) || (mini['mini-hybrid-queue'] && mini['mini-hybrid-queue'].completedAt)) },
      { area:'Lineage and capsules', ok: !!((full['lineage-transfer'] && full['lineage-transfer'].completedAt) || (mini['mini-legacy-transfer'] && mini['mini-legacy-transfer'].completedAt)) },
      { area:'Security and recovery', ok: !!((full['security-recovery'] && full['security-recovery'].completedAt) || (mini['mini-import-restore'] && mini['mini-import-restore'].completedAt)) },
      { area:'Bridge and pack seeds', ok: !!(full['bridge-and-packs'] && full['bridge-and-packs'].completedAt) }
    ];
  }
  function analyticsHtml(){
    const full = readFull();
    const mini = readMini();
    const fullTours = Object.values(full).filter(v => v && v.completedAt).length;
    const miniTours = Object.values(mini).filter(v => v && v.completedAt).length;
    const rows = latestRows();
    return `
      <div class="row" style="flex-wrap:wrap; gap:8px; margin-bottom:10px;">
        <div class="pill">Full walkthroughs ${fullTours}/8</div>
        <div class="pill">Micro guides ${miniTours}/${getMiniGuides().length}</div>
        <div class="pill">Coverage ${coverageRows().filter(r=>r.ok).length}/${coverageRows().length}</div>
      </div>
      <div class="rtx-academy-heat">
        ${coverageRows().map(row => `<div class="rtx-academy-heatcell ${row.ok ? 'ok' : 'warn'}"><h5>${esc(row.area)}</h5><div class="rtx-academy-mini">${row.ok ? 'Covered by walkthroughs' : 'Needs guided pass'}</div></div>`).join('')}
      </div>
      <table class="rtx-academy-table"><thead><tr><th>Recent learning activity</th><th>Type</th><th>Status</th></tr></thead><tbody>
        ${rows.length ? rows.map(row => `<tr><td>${esc(row.id)}</td><td>${esc(row.kind)}</td><td>${row.done ? 'Completed' : 'In progress'}</td></tr>`).join('') : '<tr><td colspan="3">No guided activity recorded yet.</td></tr>'}
      </tbody></table>`;
  }
  function currentPageGuide(){
    const view = window.APP && APP.view || 'dashboard';
    if(view === 'dashboard') return { type:'mini', id:'mini-launch-board', title:'Page guide • Launch board' };
    if(view === 'routes') return { type:'tour', id:'route-ops', title:'Page guide • Route operations' };
    if(view === 'proof') return { type:'mini', id:'mini-proof-packet', title:'Page guide • Proof packet' };
    if(view === 'export') return { type:'mini', id:'mini-import-restore', title:'Page guide • Import and restore' };
    if(view === 'settings') return { type:'tour', id:'readiness-stack', title:'Page guide • Completion and trust lanes' };
    return { type:'tour', id:'start-here', title:'Page guide • Start here' };
  }
  function ensureOverlay(){
    ensureStyle();
    if(overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'rtx-academy-overlay hidden';
    overlay.id = 'rtxAcademyOverlay';
    overlay.innerHTML = `<div class="rtx-academy-dock">
      <div class="pill" id="rtxAcademyMeta">Step 1 / 1</div>
      <h3 id="rtxAcademyTitle">Routex academy guide</h3>
      <p id="rtxAcademyBody"></p>
      <div class="rtx-academy-bar"><i id="rtxAcademyBar"></i></div>
      <div class="row" style="flex-wrap:wrap; gap:8px;">
        <button class="btn small" id="rtxAcademyBackBtn" type="button">Back</button>
        <button class="btn small" id="rtxAcademyNextBtn" type="button">Next</button>
        <div class="grow"></div>
        <button class="btn small" id="rtxAcademyHubBtn" type="button">Academy</button>
        <button class="btn small danger" id="rtxAcademyCloseBtn" type="button">Close</button>
      </div>
    </div>`;
    document.body.appendChild(overlay);
    document.getElementById('rtxAcademyBackBtn').onclick = ()=> moveMini(-1);
    document.getElementById('rtxAcademyNextBtn').onclick = ()=> moveMini(1);
    document.getElementById('rtxAcademyHubBtn').onclick = ()=> openAcademyCenter();
    document.getElementById('rtxAcademyCloseBtn').onclick = ()=> closeMini();
    return overlay;
  }
  function clearTarget(){
    if(activeTarget){ activeTarget.classList.remove('rtx-academy-target'); activeTarget = null; }
  }
  async function resolveTarget(step){
    if(!step.selector) return null;
    let el = null;
    for(let i=0;i<10;i++){
      el = document.querySelector(step.selector);
      if(el) break;
      await wait(80);
    }
    return el;
  }
  async function applyMiniStep(){
    if(!active) return;
    const guide = getMiniGuide(active.id);
    if(!guide) return;
    const step = guide.steps[active.index];
    if(!step) return;
    if(step.view) await gotoView(step.view);
    if(typeof step.before === 'function'){ try{ await step.before(); }catch(_){} }
    clearTarget();
    const target = await resolveTarget(step);
    if(target){ activeTarget = target; target.classList.add('rtx-academy-target'); target.scrollIntoView?.({behavior:'smooth', block:'center', inline:'center'}); }
    ensureOverlay();
    overlay.classList.remove('hidden');
    document.getElementById('rtxAcademyMeta').textContent = 'Step ' + (active.index + 1) + ' / ' + guide.steps.length;
    document.getElementById('rtxAcademyTitle').textContent = step.title || guide.title;
    document.getElementById('rtxAcademyBody').textContent = step.body || '';
    document.getElementById('rtxAcademyBar').style.width = (((active.index + 1) / guide.steps.length) * 100).toFixed(1) + '%';
    document.getElementById('rtxAcademyBackBtn').disabled = active.index === 0;
    document.getElementById('rtxAcademyNextBtn').textContent = active.index === guide.steps.length - 1 ? 'Finish' : 'Next';
    markMini(active.id, { inProgress:true, lastStep: active.index + 1 });
  }
  async function moveMini(delta){
    if(!active) return;
    const guide = getMiniGuide(active.id);
    if(!guide) return;
    const next = active.index + delta;
    if(next < 0) return;
    if(next >= guide.steps.length){
      markMini(active.id, { inProgress:false, completedAt:new Date().toISOString(), lastStep: guide.steps.length });
      closeMini();
      toast('Micro guide completed.', 'good');
      openAcademyCenter();
      return;
    }
    active.index = next;
    await applyMiniStep();
  }
  function closeMini(){ clearTarget(); if(overlay) overlay.classList.add('hidden'); active = null; }
  function startMiniGuide(id){ if(!getMiniGuide(id)) return; active = { id, index:0 }; applyMiniStep(); }
  function launchItem(type, id){
    if(type === 'tour'){
      closeMini();
      if(typeof window.startRoutexInteractiveTour === 'function') window.startRoutexInteractiveTour(id);
      return;
    }
    startMiniGuide(id);
  }
  function openPack(packId){
    const pack = getRolePacks().find(p => p.id === packId);
    if(!pack || typeof window.openModal !== 'function') return;
    const body = `<div class="hint">${esc(pack.summary)}</div><div class="sep"></div><div class="rtx-academy-grid">${pack.guides.map((row, idx) => {
      const type = row[0], id = row[1];
      const label = type === 'tour' ? id : (getMiniGuide(id)?.title || id);
      return `<div class="rtx-academy-card"><h4>Step ${idx+1}</h4><p>${esc(label)}</p><button class="btn small" data-rtx-pack-launch="${esc(type)}::${esc(id)}">Launch</button></div>`;
    }).join('')}</div>`;
    window.openModal(pack.title, body, `<button class="btn" onclick="document.getElementById('modalClose').click()">Close</button>`);
    document.querySelectorAll('[data-rtx-pack-launch]').forEach(btn => {
      btn.onclick = ()=>{
        const [type,id] = String(btn.getAttribute('data-rtx-pack-launch')||'').split('::');
        document.getElementById('modalClose')?.click();
        launchItem(type,id);
      };
    });
  }
  function academyHtml(){
    const pageGuide = currentPageGuide();
    return `
      <div class="hint">Routex Academy adds role-based learning packs, micro walkthroughs, page-aware guidance, and a learning heatmap so the product keeps teaching itself even after the first tours are done.</div>
      <div class="sep"></div>
      <div class="row" style="flex-wrap:wrap; gap:8px;">
        <button class="btn" id="rtxAcademyRecommendedBtn">Run recommended onboarding</button>
        <button class="btn" id="rtxAcademyPageGuideBtn">Run ${esc(pageGuide.title)}</button>
      </div>
      <div class="sep"></div>
      <h3 style="margin:0 0 8px;">Learning analytics and heatmap</h3>
      ${analyticsHtml()}
      <div class="sep"></div>
      <h3 style="margin:0 0 8px;">Role-based onboarding packs</h3>
      <div class="rtx-academy-grid">${getRolePacks().map(pack => `<div class="rtx-academy-card"><h4>${esc(pack.title)}</h4><p>${esc(pack.summary)}</p><div class="rtx-academy-mini">${pack.guides.length} guided moves</div><div class="sep"></div><button class="btn small" data-rtx-pack="${esc(pack.id)}">Open pack</button></div>`).join('')}</div>
      <div class="sep"></div>
      <h3 style="margin:0 0 8px;">Micro walkthrough library</h3>
      <div class="rtx-academy-grid">${getMiniGuides().map(g => `<div class="rtx-academy-card"><h4>${esc(g.title)}</h4><p>${esc(g.description)}</p><div class="rtx-academy-mini">${g.steps.length} screen-changing step(s)</div><div class="sep"></div><button class="btn small" data-rtx-mini="${esc(g.id)}">Start micro guide</button></div>`).join('')}</div>`;
  }
  function bindAcademyModal(){
    document.getElementById('rtxAcademyRecommendedBtn')?.addEventListener('click', ()=>{ document.getElementById('modalClose')?.click(); if(typeof window.startRoutexRecommendedOnboarding === 'function') window.startRoutexRecommendedOnboarding(); });
    document.getElementById('rtxAcademyPageGuideBtn')?.addEventListener('click', ()=>{
      const guide = currentPageGuide();
      document.getElementById('modalClose')?.click();
      launchItem(guide.type, guide.id);
    });
    document.querySelectorAll('[data-rtx-mini]').forEach(btn => btn.onclick = ()=>{ const id = btn.getAttribute('data-rtx-mini'); document.getElementById('modalClose')?.click(); startMiniGuide(id); });
    document.querySelectorAll('[data-rtx-pack]').forEach(btn => btn.onclick = ()=> openPack(btn.getAttribute('data-rtx-pack')));
    document.querySelectorAll('[data-rtx-academy-tour]').forEach(btn => btn.onclick = ()=>{ const id = btn.getAttribute('data-rtx-academy-tour'); document.getElementById('modalClose')?.click(); if(typeof window.startRoutexInteractiveTour === 'function') window.startRoutexInteractiveTour(id); });
  }
  function openAcademyCenter(){
    if(typeof window.openModal !== 'function') return;
    window.openModal('Routex Academy', academyHtml(), `<button class="btn" onclick="document.getElementById('modalClose').click()">Close</button>`);
    bindAcademyModal();
  }
  function academyCardHtml(){
    const pageGuide = currentPageGuide();
    return `<h2>Routex Academy</h2><div class="hint">Role packs, micro walkthroughs, page-aware guidance, and learning analytics live here so the app keeps teaching the operator after onboarding.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap; gap:8px;"><div class="pill">Micro guides ${Object.values(readMini()).filter(v=>v&&v.completedAt).length}/${getMiniGuides().length}</div><div class="pill">Next page guide: ${esc(pageGuide.title)}</div><button class="btn" id="rtxAcademyOpenBtn">Open academy</button><button class="btn" id="rtxAcademyPageBtn">Run page guide</button></div>`;
  }
  function injectButtons(){
    ensureStyle();
    const host = document.querySelector('.topbar .row:last-of-type') || document.querySelector('.topbar .row');
    if(host && !document.getElementById('rtxAcademyTopBtn')){
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.id = 'rtxAcademyTopBtn';
      btn.textContent = 'Academy';
      host.appendChild(btn);
      btn.onclick = openAcademyCenter;
    }
    if(host && !document.getElementById('rtxPageGuideTopBtn')){
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.id = 'rtxPageGuideTopBtn';
      btn.textContent = 'Page guide';
      host.appendChild(btn);
      btn.onclick = ()=>{ const guide = currentPageGuide(); launchItem(guide.type, guide.id); };
    }
    const grid = document.querySelector('#content .grid');
    if(grid && !document.getElementById('rtxAcademyDashboardCard') && window.APP && APP.view === 'dashboard'){
      const card = document.createElement('div');
      card.className = 'card';
      card.id = 'rtxAcademyDashboardCard';
      card.style.gridColumn = 'span 12';
      card.innerHTML = academyCardHtml();
      const anchor = document.getElementById('rtxTutorialLaunchpadCard');
      if(anchor && anchor.parentNode) anchor.parentNode.insertBefore(card, anchor.nextSibling); else grid.insertBefore(card, grid.firstChild);
      document.getElementById('rtxAcademyOpenBtn')?.addEventListener('click', openAcademyCenter);
      document.getElementById('rtxAcademyPageBtn')?.addEventListener('click', ()=>{ const guide = currentPageGuide(); launchItem(guide.type, guide.id); });
    }
    if(grid && !document.getElementById('rtxAcademySettingsCard') && window.APP && APP.view === 'settings'){
      const card = document.createElement('div');
      card.className = 'card';
      card.id = 'rtxAcademySettingsCard';
      card.style.gridColumn = 'span 12';
      card.innerHTML = `<h2>Academy, role packs, and explainers</h2><div class="hint">This app now includes role-based launch packs, page-aware guides, micro walkthroughs, and inline explainers for deep settings lanes.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap; gap:8px;"><button class="btn" id="rtxAcademySettingsOpen">Open academy</button><button class="btn" id="rtxAcademySettingsPage">Run page guide</button></div>`;
      const anchor = document.getElementById('rtxTutorialSettingsCard');
      if(anchor && anchor.parentNode) anchor.parentNode.insertBefore(card, anchor.nextSibling); else grid.insertBefore(card, grid.firstChild);
      document.getElementById('rtxAcademySettingsOpen')?.addEventListener('click', openAcademyCenter);
      document.getElementById('rtxAcademySettingsPage')?.addEventListener('click', ()=>{ const guide = currentPageGuide(); launchItem(guide.type, guide.id); });
    }
  }
  function explainerCatalog(){
    return [
      { selector:'#st_human_walkthrough', title:'Walkthrough closeout lane', body:'This lane records the real no-dead walkthrough and packages the binder that proves the app was actually walked end to end.', type:'mini', id:'mini-completion-binder' },
      { selector:'#st_optional_hybrid', title:'Hybrid queue lane', body:'Hybrid mode is optional. This explainer makes the queue, export, and cleanup path obvious before the user moves data.', type:'mini', id:'mini-hybrid-queue' },
      { selector:'#st_backup', title:'Recovery lane', body:'Backup, encrypted backup, and import belong together. This explainer teaches recovery before any destructive action.', type:'mini', id:'mini-import-restore' },
      { selector:'#st_legacy_intake', title:'Legacy and lineage lane', body:'Legacy intake protects package history. Capsules and compare flows stop older artifacts from becoming opaque.', type:'mini', id:'mini-legacy-transfer' },
      { selector:'#ex_packet', title:'Proof packet lane', body:'Proof packets are the fastest client-safe export path when you need visible evidence without opening the whole workspace.', type:'mini', id:'mini-proof-packet' },
      { selector:'#routexLaunchBoardCard', title:'Launch board lane', body:'The launch board answers what is green, what is blocked, and what to do next without making the operator infer it.', type:'mini', id:'mini-launch-board' }
    ];
  }
  function matchExplainerByTitle(title){
    const t = clean(title).toLowerCase();
    if(!t) return null;
    if(t.includes('interactive walkthrough')) return { title:'Routex Academy', body:'The Academy extends the core tutorial center with role packs, micro guides, page-aware guidance, and a learning heatmap.', type:'mini', id:'mini-launch-board' };
    if(t.includes('human walkthrough')) return { title:'Walkthrough closeout lane', body:'This modal is part of the no-dead proof story. Save the walkthrough and binder so closure is documented, not assumed.', type:'mini', id:'mini-completion-binder' };
    if(t.includes('hybrid')) return { title:'Hybrid queue lane', body:'Hybrid mode is optional but fully visible. Use the guided queue pass if you need sync, export, or cleanup clarity.', type:'mini', id:'mini-hybrid-queue' };
    if(t.includes('backup') || t.includes('restore')) return { title:'Recovery lane', body:'Backup and restore belong together. The micro guide shows import and route-pack recovery in the right order.', type:'mini', id:'mini-import-restore' };
    if(t.includes('legacy') || t.includes('capsule')) return { title:'Legacy and capsules lane', body:'Use the lineage guide when you need history, compare state, or portable recovery proofs.', type:'mini', id:'mini-legacy-transfer' };
    return null;
  }
  function injectModalExplainer(title){
    ensureStyle();
    const spec = pendingExplainer || matchExplainerByTitle(title);
    pendingExplainer = null;
    if(!spec) return;
    const body = document.getElementById('modalBody') || document.querySelector('#modalWrap .modal-body') || document.querySelector('#modalWrap .body');
    if(!body || body.querySelector('.rtx-academy-explainer')) return;
    const box = document.createElement('div');
    box.className = 'rtx-academy-explainer';
    box.innerHTML = `<h4>${esc(spec.title)}</h4><p>${esc(spec.body)}</p><div class="row" style="flex-wrap:wrap; gap:8px;"><button class="btn small" id="rtxAcademyExplainerGuideBtn" type="button">Start guide</button><button class="btn small" id="rtxAcademyExplainerOpenBtn" type="button">Open academy</button></div>`;
    body.prepend(box);
    document.getElementById('rtxAcademyExplainerGuideBtn')?.addEventListener('click', ()=>{ document.getElementById('modalClose')?.click(); launchItem(spec.type, spec.id); });
    document.getElementById('rtxAcademyExplainerOpenBtn')?.addEventListener('click', ()=>{ document.getElementById('modalClose')?.click(); openAcademyCenter(); });
  }
  const modalSpecs = explainerCatalog();
  document.addEventListener('click', (ev)=>{
    const target = ev.target;
    for(const spec of modalSpecs){
      try{
        if(target && target.closest && target.closest(spec.selector)){
          pendingExplainer = spec;
          break;
        }
      }catch(_){}
    }
  }, true);
  if(typeof window.openModal === 'function' && !window.__ROUTEX_V37_OPENMODAL_WRAPPED__){
    const prev = window.openModal;
    window.__ROUTEX_V37_OPENMODAL_WRAPPED__ = true;
    window.openModal = function(title, body, footer){
      const out = prev.apply(this, arguments);
      setTimeout(()=> injectModalExplainer(title), 0);
      return out;
    };
  }
  const observer = new MutationObserver(()=> injectButtons());
  observer.observe(document.documentElement || document.body, { childList:true, subtree:true });
  const prevRender = window.render;
  if(typeof prevRender === 'function' && !window.__ROUTEX_V37_RENDER_WRAPPED__){
    window.__ROUTEX_V37_RENDER_WRAPPED__ = true;
    window.render = async function(){
      const out = await prevRender.apply(this, arguments);
      setTimeout(()=> injectButtons(), 0);
      return out;
    };
  }
  window.openRoutexAcademyCenter = openAcademyCenter;
  window.startRoutexMiniGuide = startMiniGuide;
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ()=> setTimeout(()=> injectButtons(), 120));
  else setTimeout(()=> injectButtons(), 120);
})();
