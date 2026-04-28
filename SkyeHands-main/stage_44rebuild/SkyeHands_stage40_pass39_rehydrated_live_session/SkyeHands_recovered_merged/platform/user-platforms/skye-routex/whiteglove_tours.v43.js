/* V43 Routex white-glove academy walkthroughs */
(function(){
  if(window.__ROUTEX_WHITEGLOVE_ACADEMY_V43__) return;
  window.__ROUTEX_WHITEGLOVE_ACADEMY_V43__ = true;

  const PROGRESS_KEY = 'skye_routex_whiteglove_tours_v43';
  const STATE_KEY = 'skye_routex_whiteglove_academy_state_v43';
  const clean = (v)=> String(v == null ? '' : v).trim();
  const esc = (v)=> String(v == null ? '' : v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const wait = (ms)=> new Promise(resolve => setTimeout(resolve, ms));
  const toast = window.toast || function(){};
  let overlay = null;
  let activeTour = null;
  let activeTarget = null;

  function readJSON(key, fallback){ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } }
  function writeJSON(key, value){ try{ localStorage.setItem(key, JSON.stringify(value)); }catch(_){} return value; }
  function readProgress(){ return readJSON(PROGRESS_KEY, {}); }
  function saveProgress(v){ return writeJSON(PROGRESS_KEY, v || {}); }
  function readState(){ return readJSON(STATE_KEY, { openedAt:'', lastTour:'' }); }
  function saveState(patch){ return writeJSON(STATE_KEY, Object.assign({}, readState(), patch || {})); }
  function markProgress(id, patch){ const next = readProgress(); next[id] = Object.assign({}, next[id] || {}, patch || {}, { updatedAt:new Date().toISOString() }); return saveProgress(next)[id]; }

  function getTours(){
    return [
      {
        id:'wg43-foundation',
        title:'White-glove foundations',
        description:'Moves through rider/service profiles, drivers, vehicles, and memberships so the premium service contract becomes concrete.',
        covers:['service profiles','drivers','vehicles','memberships','favorite-driver continuity'],
        steps:[
          { view:'dashboard', title:'White-glove launchpad', body:'This pass starts on the live Routex surface, then opens the actual white-glove controls the operator uses to build premium service records.' },
          { view:'dashboard', before: async ()=>{ if(typeof window.openWhiteGloveFleetOps === 'function') window.openWhiteGloveFleetOps(); await wait(220); }, selector:'#wgV39ProfileForm', title:'Service profiles', body:'This is the real service-profile lane for rider, household, business, VIP, medical, and executive records.' },
          { view:'dashboard', before: async ()=>{ if(typeof window.openWhiteGloveFleetOps === 'function') window.openWhiteGloveFleetOps(); await wait(220); }, selector:'#wgV39DriverForm', title:'Driver profiles', body:'Drivers carry service score, capability, market coverage, and payout behavior. The walkthrough lands on the live driver form, not a fake help card.' },
          { view:'dashboard', before: async ()=>{ if(typeof window.openWhiteGloveFleetOps === 'function') window.openWhiteGloveFleetOps(); await wait(220); }, selector:'#wgV39VehicleForm', title:'Vehicle profiles', body:'Vehicles define class, capacity, and dispatch eligibility for the chauffeur stack.' },
          { view:'dashboard', before: async ()=>{ if(typeof window.openWhiteGloveFleetOps === 'function') window.openWhiteGloveFleetOps(); await wait(220); }, selector:'#wgV39MembershipForm', title:'Membership ledger foundation', body:'Memberships are first-class records with included hours, miles, renewal logic, and continuity against the rider profile.' }
        ]
      },
      {
        id:'wg43-booking-pricing',
        title:'Booking and pricing lifecycle',
        description:'Shows canonical booking capture, frozen pricing, quote preview, assignment, and close-ready storage.',
        covers:['booking intake','quote preview','pricing snapshot','assignment','close-ready booking state'],
        steps:[
          { view:'dashboard', before: async ()=>{ if(typeof window.openWhiteGloveFleetOps === 'function') window.openWhiteGloveFleetOps(); await wait(220); }, selector:'#wgV39BookingForm', title:'Canonical booking form', body:'This is the live canonical booking contract. Every promised premium ride starts here as one real booking record.' },
          { view:'dashboard', before: async ()=>{ if(typeof window.openWhiteGloveFleetOps === 'function') window.openWhiteGloveFleetOps(); await wait(220); }, selector:'#wgV39QuoteForm', title:'Quote and pricing controls', body:'The quote lane previews rate logic before confirmation so the operator can see the premium service economics early.' },
          { view:'dashboard', before: async ()=>{ if(typeof window.openWhiteGloveFleetOps === 'function') window.openWhiteGloveFleetOps(); await wait(220); }, selector:'#wgV39QuotePreview', title:'Frozen pricing snapshot', body:'Pricing is stored onto the booking so later changes do not corrupt billing history or member-rate evidence.' },
          { view:'dashboard', before: async ()=>{ if(typeof window.openWhiteGloveFleetOps === 'function') window.openWhiteGloveFleetOps(); await wait(220); }, selector:'#wgV39AssignForm', title:'Driver and vehicle assignment', body:'Assignment ties the rider, favorite-driver state, driver, and vehicle into one execution-ready booking.' },
          { view:'dashboard', before: async ()=>{ if(typeof window.openWhiteGloveFleetOps === 'function') window.openWhiteGloveFleetOps(); await wait(220); }, selector:'#wgV39CloseForm', title:'Close-ready booking state', body:'The close form proves the booking does not stop at request UI. The same record survives into execution and closeout.' }
        ]
      },
      {
        id:'wg43-dispatch-board',
        title:'Dispatch board and recurring work',
        description:'Walks through premium intake, dispatch visibility, recurring templates, sync pressure, and conflict review.',
        covers:['dispatch board','premium intake','recurring templates','sync queue','conflict review'],
        steps:[
          { view:'dashboard', before: async ()=>{ if(typeof window.openWhiteGloveDispatchBoardV40 === 'function') window.openWhiteGloveDispatchBoardV40('intake'); await wait(220); }, selector:'#wg40IntakeForm', title:'Premium intake', body:'This is the dispatch intake lane for new premium bookings before they become route-linked service work.' },
          { view:'dashboard', before: async ()=>{ if(typeof window.openWhiteGloveDispatchBoardV40 === 'function') window.openWhiteGloveDispatchBoardV40('dispatch'); await wait(220); }, selector:'#wgV40ModalBody', title:'Dispatch workspace', body:'The dispatch tab is where unassigned, assigned, and live bookings are turned into actual operator work.' },
          { view:'dashboard', before: async ()=>{ if(typeof window.openWhiteGloveDispatchBoardV40 === 'function') window.openWhiteGloveDispatchBoardV40('templates'); await wait(220); }, selector:'#wg40TemplateInstantiateForm', title:'Recurring templates', body:'Recurring rides are not hand-waved. The tutorial lands on the live template-instantiation form for repeat service.' },
          { view:'dashboard', before: async ()=>{ if(typeof window.openWhiteGloveDispatchBoardV40 === 'function') window.openWhiteGloveDispatchBoardV40('sync'); await wait(220); }, selector:'#wgV40ModalBody', title:'Sync queue visibility', body:'Website and dispatch sync pressure is visible and reviewable instead of hidden behind fake success states.' },
          { view:'dashboard', before: async ()=>{ if(typeof window.openWhiteGloveDispatchBoardV40 === 'function') window.openWhiteGloveDispatchBoardV40('conflicts'); await wait(220); }, selector:'#wgV40ModalBody', title:'Conflict review', body:'Conflict reporting keeps driver, vehicle, and rider overlap transparent before the operator commits the work.' }
        ]
      },
      {
        id:'wg43-execution-payout',
        title:'Execution, service quality, and payout',
        description:'Moves through the live chauffeur board, assistance capture, payout ledger, and exported reports.',
        covers:['live execution','wait and standby','service recovery','payout ledger','service reports'],
        steps:[
          { view:'dashboard', before: async ()=>{ if(typeof window.openWhiteGloveExecutionCenterV41 === 'function') window.openWhiteGloveExecutionCenterV41('live'); await wait(220); }, selector:'#routexWg41Body', title:'Live chauffeur board', body:'This is the live execution lane for arrived, boarded, in-service, wait, assistance, and closeout flow.' },
          { view:'dashboard', before: async ()=>{ if(typeof window.openWhiteGloveExecutionCenterV41 === 'function') window.openWhiteGloveExecutionCenterV41('live'); await wait(220); }, getTarget: async ()=> document.querySelector('.wg41-act[data-action="wait-start"]') || document.querySelector('#routexWg41Body'), title:'Wait and assistance actions', body:'Wait and assistance are real service controls inside the board. The tutorial highlights the actual live action row when it exists.' },
          { view:'dashboard', before: async ()=>{ if(typeof window.openWhiteGloveExecutionCenterV41 === 'function') window.openWhiteGloveExecutionCenterV41('payout'); await wait(220); }, selector:'#routexWg41Body', title:'Driver payout ledger', body:'Customer money and driver money are both explained in-product. The payout ledger is part of the same canonical service chain.' },
          { view:'dashboard', before: async ()=>{ if(typeof window.openWhiteGloveExecutionCenterV41 === 'function') window.openWhiteGloveExecutionCenterV41('reports'); await wait(220); }, selector:'#routexWg41Body', title:'Reports and proof docs', body:'Reports, premium service summary, payout docs, and dispute notes are exposed from the live execution layer.' }
        ]
      },
      {
        id:'wg43-website-analytics-restore',
        title:'Website intake, analytics, and restore safety',
        description:'Covers website-origin booking requests, retryable sync, analytics snapshots, and backup/restore hardening.',
        covers:['website requests','sync retry','analytics snapshot','backup bundle','restore preview'],
        steps:[
          { view:'dashboard', before: async ()=>{ if(typeof window.openWhiteGloveWebsiteAnalyticsCenterV42 === 'function') window.openWhiteGloveWebsiteAnalyticsCenterV42('website'); await wait(220); }, selector:'#wg42RequestForm', title:'Website booking request', body:'Website-origin rides are first-class requests in the same operator app instead of email theater.' },
          { view:'dashboard', before: async ()=>{ if(typeof window.openWhiteGloveWebsiteAnalyticsCenterV42 === 'function') window.openWhiteGloveWebsiteAnalyticsCenterV42('website'); await wait(220); }, selector:'#wg42RetrySync', title:'Retryable sync ledger', body:'If sync pressure exists, the operator can see and retry it locally from the same surface.' },
          { view:'dashboard', before: async ()=>{ if(typeof window.openWhiteGloveWebsiteAnalyticsCenterV42 === 'function') window.openWhiteGloveWebsiteAnalyticsCenterV42('analytics'); await wait(220); }, selector:'#wg42SaveAnalytics', title:'Chauffeur analytics snapshots', body:'The analytics lane makes premium service economics visible by market, tier, continuity, and revenue mix.' },
          { view:'dashboard', before: async ()=>{ if(typeof window.openWhiteGloveWebsiteAnalyticsCenterV42 === 'function') window.openWhiteGloveWebsiteAnalyticsCenterV42('backup'); await wait(220); }, selector:'#wg42SaveBackup', title:'Backup bundle', body:'Backup is part of daily operator safety for the premium stack, not a buried admin afterthought.' },
          { view:'dashboard', before: async ()=>{ if(typeof window.openWhiteGloveWebsiteAnalyticsCenterV42 === 'function') window.openWhiteGloveWebsiteAnalyticsCenterV42('backup'); await wait(220); }, selector:'#wg42PreviewRestore', title:'Restore preview and apply', body:'Restore preview teaches duplicate counts and merge versus replace behavior before the operator touches the actual data.' }
        ]
      },
      {
        id:'wg43-settings-and-help',
        title:'Settings, Fleet Academy, and guided help',
        description:'Shows where the white-glove help system lives so users can relaunch training without leaving the product.',
        covers:['settings tutorial access','fleet academy','role packs','page guides'],
        steps:[
          { view:'settings', selector:'#routexWg43SettingsCard', title:'Settings tutorial center', body:'The Fleet Academy lives inside Settings too, so users always have a visible training lane when the app feels dense.' },
          { view:'settings', selector:'#routexWg43SettingsOpen', title:'Open Fleet Academy', body:'This is the settings-side launcher for all white-glove tours and role-based learning packs.' },
          { view:'settings', selector:'#routexWg43SettingsPage', title:'Run page guide', body:'Page guides teach the current surface without making the operator hunt through a separate manual.' }
        ]
      }
    ];
  }

  function getRolePacks(){
    return [
      { id:'dispatcher-pack', title:'Dispatcher mission pack', summary:'Foundation, booking, dispatch, and execution in one guided sequence.', tours:['wg43-foundation','wg43-booking-pricing','wg43-dispatch-board','wg43-execution-payout'] },
      { id:'continuity-pack', title:'Rider continuity pack', summary:'Profiles, memberships, booking flow, and website-origin continuity.', tours:['wg43-foundation','wg43-booking-pricing','wg43-website-analytics-restore'] },
      { id:'admin-pack', title:'Operations and recovery pack', summary:'Dispatch, analytics, backup/restore, and settings-side Academy access.', tours:['wg43-dispatch-board','wg43-website-analytics-restore','wg43-settings-and-help'] }
    ];
  }

  function coverageRows(){
    const progress = readProgress();
    return [
      ['Service profiles and preferences',['wg43-foundation']],
      ['Drivers, vehicles, and memberships',['wg43-foundation']],
      ['Booking, pricing, and assignment',['wg43-booking-pricing']],
      ['Dispatch, recurring templates, and conflicts',['wg43-dispatch-board']],
      ['Execution, assistance, and payout',['wg43-execution-payout']],
      ['Website queue, analytics, and restore',['wg43-website-analytics-restore']],
      ['Settings-side guided help',['wg43-settings-and-help']]
    ].map(([label, ids])=>({ label, ok: ids.some(id => progress[id] && progress[id].completedAt), ids }));
  }

  async function gotoView(viewId){
    if(!window.APP) return true;
    if(APP.view !== viewId){
      APP.view = viewId;
      try{ window.location.hash = viewId; }catch(_){}
      if(typeof window.render === 'function') await window.render();
      await wait(180);
    }else{
      await wait(80);
    }
    return true;
  }

  function clearTarget(){ if(activeTarget){ activeTarget.classList.remove('rtx-wg43-target'); activeTarget = null; } }
  function ensureStyle(){
    if(document.getElementById('routexWhiteGloveAcademyStylesV43')) return;
    const style = document.createElement('style');
    style.id = 'routexWhiteGloveAcademyStylesV43';
    style.textContent = `.rtx-wg43-target{position:relative !important; z-index:10012 !important; box-shadow:0 0 0 3px rgba(245,197,66,.95),0 0 0 9999px rgba(3,1,8,.56) !important; border-radius:16px !important;} .rtx-wg43-overlay{position:fixed; inset:0; z-index:10011; pointer-events:none;} .rtx-wg43-dock{position:fixed; right:18px; bottom:18px; width:min(440px,calc(100vw - 28px)); border:1px solid rgba(255,255,255,.16); border-radius:20px; background:linear-gradient(180deg, rgba(18,8,32,.96), rgba(8,3,16,.94)); box-shadow:0 28px 80px rgba(0,0,0,.52); padding:16px; color:rgba(255,255,255,.94); pointer-events:auto;} .rtx-wg43-title{font-size:19px; font-weight:900; margin:0 0 6px;} .rtx-wg43-body{font-size:13px; line-height:1.5; color:rgba(255,255,255,.80); white-space:pre-wrap;} .rtx-wg43-progress{height:7px; border-radius:999px; background:rgba(255,255,255,.10); overflow:hidden; margin:14px 0 12px;} .rtx-wg43-progress>i{display:block; height:100%; width:0; background:linear-gradient(90deg, rgba(245,197,66,.95), rgba(168,85,247,.92));} .rtx-wg43-grid{display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:10px; margin-top:12px;} .rtx-wg43-card{border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.04); border-radius:16px; padding:12px;} .rtx-wg43-card h4{margin:0 0 6px; font-size:14px;} .rtx-wg43-card p{margin:0 0 10px; color:rgba(255,255,255,.72); font-size:12px; line-height:1.45;} .rtx-wg43-mini{font-size:11px; color:rgba(255,255,255,.62);} .rtx-wg43-table{width:100%; border-collapse:collapse; margin-top:12px;} .rtx-wg43-table th,.rtx-wg43-table td{padding:8px; border-bottom:1px solid rgba(255,255,255,.08); text-align:left; vertical-align:top; font-size:12px;}`;
    document.head.appendChild(style);
  }
  function ensureOverlay(){
    ensureStyle();
    if(overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'rtx-wg43-overlay hidden';
    overlay.id = 'rtxWhiteGloveTourOverlayV43';
    overlay.innerHTML = `<div class="rtx-wg43-dock"><div class="pill" id="rtxWg43Meta">Step 1 / 1</div><h3 class="rtx-wg43-title" id="rtxWg43Title">White-glove walkthrough</h3><div class="rtx-wg43-body" id="rtxWg43Body"></div><div class="rtx-wg43-progress"><i id="rtxWg43Bar"></i></div><div class="row" style="flex-wrap:wrap; gap:8px;"><button class="btn small" id="rtxWg43Back" type="button">Back</button><button class="btn small" id="rtxWg43Next" type="button">Next</button><div class="spacer"></div><button class="btn small" id="rtxWg43Hub" type="button">Fleet Academy</button><button class="btn small danger" id="rtxWg43Close" type="button">Close</button></div></div>`;
    document.body.appendChild(overlay);
    document.getElementById('rtxWg43Back').onclick = ()=> moveStep(-1);
    document.getElementById('rtxWg43Next').onclick = ()=> moveStep(1);
    document.getElementById('rtxWg43Hub').onclick = ()=> openCenter();
    document.getElementById('rtxWg43Close').onclick = ()=> closeTour(true);
    return overlay;
  }
  async function resolveTarget(step){
    if(typeof step.getTarget === 'function'){ try{ return await step.getTarget(); }catch(_){ return null; } }
    if(!step.selector) return null;
    let target = null;
    for(let i=0;i<12;i++){ target = document.querySelector(step.selector); if(target) break; await wait(90); }
    return target;
  }
  async function highlight(step){
    clearTarget();
    const target = await resolveTarget(step || {});
    if(target){ activeTarget = target; target.classList.add('rtx-wg43-target'); target.scrollIntoView?.({ behavior:'smooth', block:'center', inline:'center' }); }
  }
  async function applyStep(){
    if(!activeTour) return; const tour = getTours().find(t => t.id === activeTour.id); if(!tour) return; const step = tour.steps[activeTour.index]; if(!step) return;
    if(step.view) await gotoView(step.view);
    if(typeof step.before === 'function'){ try{ await step.before(); }catch(_){} }
    await highlight(step);
    ensureOverlay(); overlay.classList.remove('hidden');
    document.getElementById('rtxWg43Meta').textContent = 'Step ' + (activeTour.index + 1) + ' / ' + tour.steps.length;
    document.getElementById('rtxWg43Title').textContent = step.title || tour.title;
    document.getElementById('rtxWg43Body').textContent = step.body || '';
    document.getElementById('rtxWg43Bar').style.width = (((activeTour.index + 1) / tour.steps.length) * 100).toFixed(1) + '%';
    document.getElementById('rtxWg43Back').disabled = activeTour.index === 0;
    document.getElementById('rtxWg43Next').textContent = activeTour.index === tour.steps.length - 1 ? 'Finish' : 'Next';
    markProgress(activeTour.id, { inProgress:true, lastStep: activeTour.index + 1 });
    saveState({ lastTour: activeTour.id });
    injectButtons();
  }
  async function moveStep(delta){
    if(!activeTour) return; const tour = getTours().find(t => t.id === activeTour.id); if(!tour) return; const next = activeTour.index + delta; if(next < 0) return;
    if(next >= tour.steps.length){ markProgress(activeTour.id, { inProgress:false, completedAt:new Date().toISOString(), lastStep: tour.steps.length }); const queue = Array.isArray(activeTour.queue) ? activeTour.queue.slice() : []; closeTour(false); toast('White-glove walkthrough completed.','good'); if(queue.length){ await wait(140); startTour(queue[0], queue.slice(1)); } else openCenter(); return; }
    activeTour.index = next; await applyStep();
  }
  function closeTour(reopen){ clearTarget(); if(overlay) overlay.classList.add('hidden'); if(activeTour){ markProgress(activeTour.id, { inProgress:false }); } activeTour = null; if(reopen) setTimeout(()=> openCenter(), 80); }
  function startTour(id, queue){ if(!getTours().find(t => t.id === id)) return; activeTour = { id, index:0, queue:Array.isArray(queue) ? queue : [] }; applyStep(); }

  function currentPageTourId(){ return (window.APP && APP.view === 'settings') ? 'wg43-settings-and-help' : 'wg43-foundation'; }
  function centerHtml(){
    const progress = readProgress();
    const tours = getTours();
    const done = tours.filter(t => progress[t.id] && progress[t.id].completedAt).length;
    const coverage = coverageRows();
    return `<div class="hint">White-glove Fleet Academy extends the existing Routex training with guided premium-service walkthroughs. These tours open the real fleet modals, switch screens, and step through dispatch, service quality, analytics, and restore safety inside the product.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap; gap:8px;"><div class="pill">Tours ${done}/${tours.length}</div><div class="pill">Coverage ${coverage.filter(r=>r.ok).length}/${coverage.length}</div><button class="btn" id="rtxWg43PageGuide" type="button">Run page guide</button><button class="btn" id="rtxWg43StartAll" type="button">Run all fleet tours</button></div><div class="sep"></div><h3 style="margin:0 0 8px;">Role mission packs</h3><div class="rtx-wg43-grid">${getRolePacks().map(pack => `<div class="rtx-wg43-card"><h4>${esc(pack.title)}</h4><p>${esc(pack.summary)}</p><div class="rtx-wg43-mini">${pack.tours.length} guided passes</div><div class="sep"></div><button class="btn small" data-rtx-wg43-pack="${esc(pack.id)}" type="button">Run pack</button></div>`).join('')}</div><div class="sep"></div><h3 style="margin:0 0 8px;">White-glove walkthrough library</h3><div class="rtx-wg43-grid">${tours.map(t => `<div class="rtx-wg43-card"><h4>${esc(t.title)}</h4><p>${esc(t.description)}</p><div class="rtx-wg43-mini">${t.steps.length} screen-changing step(s) • ${progress[t.id] && progress[t.id].completedAt ? 'Completed' : 'Pending'}</div><div class="sep"></div><button class="btn small" data-rtx-wg43-tour="${esc(t.id)}" type="button">Start walkthrough</button></div>`).join('')}</div><div class="sep"></div><h3 style="margin:0 0 8px;">Coverage matrix</h3><table class="rtx-wg43-table"><thead><tr><th>Area</th><th>Status</th><th>Guided by</th></tr></thead><tbody>${coverage.map(row => `<tr><td>${esc(row.label)}</td><td>${row.ok ? 'Covered' : 'Needs guided pass'}</td><td>${row.ids.map(id => esc((tours.find(t => t.id === id) || {}).title || id)).join(', ')}</td></tr>`).join('')}</tbody></table>`;
  }
  function bindCenter(){
    document.getElementById('rtxWg43PageGuide')?.addEventListener('click', ()=>{ document.getElementById('modalClose')?.click(); startTour(currentPageTourId()); });
    document.getElementById('rtxWg43StartAll')?.addEventListener('click', ()=>{ document.getElementById('modalClose')?.click(); const ids = getTours().map(t => t.id); startTour(ids[0], ids.slice(1)); });
    document.querySelectorAll('[data-rtx-wg43-tour]').forEach(btn => btn.addEventListener('click', ()=>{ const id = btn.getAttribute('data-rtx-wg43-tour'); document.getElementById('modalClose')?.click(); startTour(id); }));
    document.querySelectorAll('[data-rtx-wg43-pack]').forEach(btn => btn.addEventListener('click', ()=>{ const pack = getRolePacks().find(p => p.id === btn.getAttribute('data-rtx-wg43-pack')); if(!pack) return; document.getElementById('modalClose')?.click(); startTour(pack.tours[0], pack.tours.slice(1)); }));
  }
  function openCenter(){ saveState({ openedAt:new Date().toISOString() }); if(typeof window.openModal === 'function'){ window.openModal('White-glove Fleet Academy', centerHtml(), '<button class="btn" onclick="document.getElementById(\'modalClose\').click()">Close</button>'); setTimeout(bindCenter, 0); return; } }

  function addGuideButton(cardSelector, id, label){ const card = document.querySelector(cardSelector); if(!card || card.querySelector('[data-rtx-wg43-card="'+id+'"]')) return; const row = card.querySelector('.row:last-of-type') || card; const btn = document.createElement('button'); btn.className = 'btn small'; btn.textContent = label || 'Guide'; btn.setAttribute('data-rtx-wg43-card', id); btn.onclick = ()=> startTour(id); row.appendChild(btn); }
  function injectButtons(){
    const toolbar = document.querySelector('#routexWorkbenchToolbar') || document.querySelector('.toolbar') || document.querySelector('.row');
    if(toolbar && !document.getElementById('routexWg43ToolbarBtn')){ const btn = document.createElement('button'); btn.id = 'routexWg43ToolbarBtn'; btn.className='btn small'; btn.textContent='Fleet tours'; btn.onclick = openCenter; toolbar.appendChild(btn); }
    const host = document.querySelector('#app') || document.body;
    if(host && !document.getElementById('routexWg43Launchpad') && window.APP && APP.view === 'dashboard'){ const card = document.createElement('div'); card.className='card'; card.id='routexWg43Launchpad'; const tours = getTours(); const progress = readProgress(); card.innerHTML = `<h2 style="margin:0 0 10px;">White-glove Fleet Academy</h2><div style="margin-bottom:12px;">Use these guided passes to learn the premium fleet stack on the real screens: profiles, bookings, dispatch, execution, website intake, analytics, restore, and settings-side help.</div><div class="row" style="flex-wrap:wrap; gap:8px;"><div class="pill">Completed ${tours.filter(t => progress[t.id] && progress[t.id].completedAt).length}/${tours.length}</div><button class="btn" id="routexWg43LaunchOpen">Open Fleet Academy</button><button class="btn" id="routexWg43LaunchPage">Run page guide</button></div>`; host.prepend(card); document.getElementById('routexWg43LaunchOpen')?.addEventListener('click', openCenter); document.getElementById('routexWg43LaunchPage')?.addEventListener('click', ()=> startTour(currentPageTourId())); }
    if(host && !document.getElementById('routexWg43SettingsCard') && window.APP && APP.view === 'settings'){ const card = document.createElement('div'); card.className='card'; card.id='routexWg43SettingsCard'; card.innerHTML = `<h2 style="margin:0 0 10px;">White-glove walkthroughs and guided help</h2><div style="margin-bottom:12px;">Settings now includes a white-glove tutorial lane so operators can relaunch training, mission packs, and page guides without leaving the app.</div><div class="row" style="flex-wrap:wrap; gap:8px;"><button class="btn" id="routexWg43SettingsOpen">Open Fleet Academy</button><button class="btn" id="routexWg43SettingsPage">Run settings guide</button></div>`; host.prepend(card); document.getElementById('routexWg43SettingsOpen')?.addEventListener('click', openCenter); document.getElementById('routexWg43SettingsPage')?.addEventListener('click', ()=> startTour('wg43-settings-and-help')); }
    addGuideButton('#wgV39SummaryCard', 'wg43-foundation', 'Foundation guide');
    addGuideButton('#wg40DispatchCard', 'wg43-dispatch-board', 'Dispatch guide');
    addGuideButton('#routexWg41Card', 'wg43-execution-payout', 'Execution guide');
    addGuideButton('#routexWg42Card', 'wg43-website-analytics-restore', 'Website+analytics guide');
  }

  const observer = new MutationObserver(()=> injectButtons());
  observer.observe(document.documentElement || document.body, { childList:true, subtree:true });
  const prevRender = window.render;
  if(typeof prevRender === 'function' && !window.__ROUTEX_WHITEGLOVE_RENDER_V43__){ window.__ROUTEX_WHITEGLOVE_RENDER_V43__ = true; window.render = async function(){ const out = await prevRender.apply(this, arguments); setTimeout(()=> injectButtons(), 0); return out; }; }
  window.openRoutexWhiteGloveAcademyV43 = openCenter;
  window.startRoutexWhiteGloveTourV43 = startTour;
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ()=> setTimeout(()=> injectButtons(), 120)); else setTimeout(()=> injectButtons(), 120);
})();
