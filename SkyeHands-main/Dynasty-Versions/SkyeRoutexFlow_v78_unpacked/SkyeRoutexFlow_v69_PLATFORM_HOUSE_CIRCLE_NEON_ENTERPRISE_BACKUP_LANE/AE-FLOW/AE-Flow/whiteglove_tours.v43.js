/* V43 AE FLOW white-glove academy walkthroughs */
(function(){
  if(window.__AEFLOW_WHITEGLOVE_ACADEMY_V43__) return;
  window.__AEFLOW_WHITEGLOVE_ACADEMY_V43__ = true;

  const PROGRESS_KEY = 'skye_aeflow_whiteglove_tours_v43';
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
  function markProgress(id, patch){ const next = readProgress(); next[id] = Object.assign({}, next[id] || {}, patch || {}, { updatedAt:new Date().toISOString() }); saveProgress(next); return next[id]; }

  function getTours(){
    return [
      {
        id:'aefwg43-continuity',
        title:'White-glove continuity and profiles',
        description:'Shows how AE FLOW stores premium rider continuity, quick profiles, memberships, and shared dossier state.',
        covers:['continuity dossiers','quick profiles','memberships','recent ride continuity'],
        steps:[
          { tab:'accounts', title:'White-glove launchpad', body:'This pass starts where AE FLOW carries continuity instead of splitting premium riders into a disconnected CRM.' },
          { tab:'accounts', before: async ()=>{ if(typeof window.openAEFlowWhiteGloveDossiers === 'function') window.openAEFlowWhiteGloveDossiers(); await wait(220); }, selector:'#aefV39QuickProfileForm', title:'Quick service profile', body:'AE FLOW can create premium service profiles directly from the shared dossier lane.' },
          { tab:'accounts', before: async ()=>{ if(typeof window.openAEFlowWhiteGloveDossiers === 'function') window.openAEFlowWhiteGloveDossiers(); await wait(220); }, selector:'#aefV39QuickMembershipForm', title:'Quick membership', body:'Membership continuity is visible from AE FLOW so follow-up, renewal, and rider value stay attached to the account story.' },
          { tab:'accounts', before: async ()=>{ if(typeof window.openAEFlowWhiteGloveDossiers === 'function') window.openAEFlowWhiteGloveDossiers(); await wait(220); }, selector:'#aefV39ProfileSelect', title:'Continuity selector', body:'This selector makes it clear that AE FLOW is reading and extending the same rider-household-membership chain as Routex.' }
        ]
      },
      {
        id:'aefwg43-booking-command',
        title:'Booking command and recurring setup',
        description:'Walks through AE-side premium intake, continuity view, recurring templates, and dispatch-board import.',
        covers:['AE-side intake','continuity context','templates','dispatch sync'],
        steps:[
          { tab:'accounts', before: async ()=>{ if(typeof window.openAEFlowWhiteGloveCommandCenterV40 === 'function') window.openAEFlowWhiteGloveCommandCenterV40('intake'); await wait(220); }, selector:'#aefwg40IntakeForm', title:'AE-side booking intake', body:'AE FLOW can create premium bookings without forcing the operator to jump into another app first.' },
          { tab:'accounts', before: async ()=>{ if(typeof window.openAEFlowWhiteGloveCommandCenterV40 === 'function') window.openAEFlowWhiteGloveCommandCenterV40('continuity'); await wait(220); }, selector:'#aefWgV40Body', title:'Continuity view', body:'The continuity tab keeps rider history and premium service context visible during intake.' },
          { tab:'accounts', before: async ()=>{ if(typeof window.openAEFlowWhiteGloveCommandCenterV40 === 'function') window.openAEFlowWhiteGloveCommandCenterV40('templates'); await wait(220); }, selector:'#aefwg40TemplateForm', title:'Recurring templates', body:'Recurring work is taught on the real template form so returning service is not a mystery.' },
          { tab:'accounts', before: async ()=>{ if(typeof window.openAEFlowWhiteGloveCommandCenterV40 === 'function') window.openAEFlowWhiteGloveCommandCenterV40('dispatch-sync'); await wait(220); }, selector:'#aefWgV40Body', title:'Dispatch-board import', body:'AE FLOW can import the Routex dispatch board so the rider continuity side sees assignment and readiness state.' }
        ]
      },
      {
        id:'aefwg43-live-service',
        title:'Live service, recovery, and payout visibility',
        description:'Shows the live chauffeur sync surface, recovery follow-up, payout visibility, and Routex-state import.',
        covers:['live service visibility','payout visibility','recovery follow-up','sync imports'],
        steps:[
          { tab:'accounts', before: async ()=>{ if(typeof window.openAEFlowWhiteGloveLiveServiceCenterV41 === 'function') window.openAEFlowWhiteGloveLiveServiceCenterV41('live'); await wait(220); }, selector:'#aefWg41Body', title:'Live service view', body:'AE FLOW can see live chauffeur state so the customer-continuity side stays aware of the ride in motion.' },
          { tab:'accounts', before: async ()=>{ if(typeof window.openAEFlowWhiteGloveLiveServiceCenterV41 === 'function') window.openAEFlowWhiteGloveLiveServiceCenterV41('payout'); await wait(220); }, selector:'#aefWg41Body', title:'Payout visibility', body:'AE FLOW does not calculate payout, but it can see the payout-facing service picture and explain it to the operator.' },
          { tab:'accounts', before: async ()=>{ if(typeof window.openAEFlowWhiteGloveLiveServiceCenterV41 === 'function') window.openAEFlowWhiteGloveLiveServiceCenterV41('recovery'); await wait(220); }, selector:'#aefWg41Body', title:'Recovery tasks', body:'Service recovery follow-up lives in the AE-side continuity lane so problem handling does not get lost after the ride.' },
          { tab:'accounts', before: async ()=>{ if(typeof window.openAEFlowWhiteGloveLiveServiceCenterV41 === 'function') window.openAEFlowWhiteGloveLiveServiceCenterV41('sync'); await wait(220); }, selector:'#aefWg41Body', title:'Routex-state sync', body:'This tab proves the bridge is visible and guided when live service status needs to come back into AE FLOW.' }
        ]
      },
      {
        id:'aefwg43-website-analytics',
        title:'Website queue, analytics, and restore visibility',
        description:'Covers imported website queue rows, sync pressure, analytics signals, and restore history visibility.',
        covers:['website queue','sync pressure','analytics visibility','restore history'],
        steps:[
          { tab:'accounts', before: async ()=>{ if(typeof window.openAEFlowWhiteGloveV42Center === 'function') window.openAEFlowWhiteGloveV42Center('overview'); await wait(220); }, selector:'#aefWg42Body', title:'Command visibility center', body:'AE FLOW imports the website queue, analytics, and restore visibility into one operator-facing command surface.' },
          { tab:'accounts', before: async ()=>{ if(typeof window.openAEFlowWhiteGloveV42Center === 'function') window.openAEFlowWhiteGloveV42Center('overview'); await wait(220); }, selector:'#aefWg42Sync', title:'Sync Routex white-glove state', body:'This is the real import control for Routex website queue, sync pressure, analytics, and restore history.' },
          { tab:'accounts', before: async ()=>{ if(typeof window.openAEFlowWhiteGloveV42Center === 'function') window.openAEFlowWhiteGloveV42Center('overview'); await wait(220); }, selector:'#aefWg42ExportImport', title:'Export imported visibility', body:'Imported command state can be exported from AE FLOW too, so visibility is portable and auditable.' }
        ]
      },
      {
        id:'aefwg43-settings-help',
        title:'Settings help and Fleet Academy',
        description:'Shows the settings-side tutorial lane so users can relaunch guided help directly from AE FLOW settings.',
        covers:['settings tutorial access','fleet academy','page guides'],
        steps:[
          { tab:'settings', selector:'#aefWg43SettingsCard', title:'Settings-side Fleet Academy', body:'Settings includes a dedicated white-glove tutorial card so the app keeps explaining itself after first use.' },
          { tab:'settings', selector:'#aefWg43SettingsOpen', title:'Open AE FLOW Fleet Academy', body:'This button relaunches the guided white-glove learning library from inside Settings.' },
          { tab:'settings', selector:'#aefWg43SettingsPage', title:'Run settings page guide', body:'Page guides keep the current screen teachable without dropping the user into a text-only help page.' }
        ]
      }
    ];
  }

  function getRolePacks(){
    return [
      { id:'aef-dispatcher', title:'Dispatcher continuity pack', summary:'Continuity, booking command, live service, and visibility in one guided sequence.', tours:['aefwg43-continuity','aefwg43-booking-command','aefwg43-live-service','aefwg43-website-analytics'] },
      { id:'aef-recovery', title:'Recovery and oversight pack', summary:'Live service, analytics visibility, and settings-side help for operators who manage follow-through.', tours:['aefwg43-live-service','aefwg43-website-analytics','aefwg43-settings-help'] }
    ];
  }

  function coverageRows(){
    const progress = readProgress();
    return [
      ['Continuity dossiers and memberships',['aefwg43-continuity']],
      ['Booking command and recurring templates',['aefwg43-booking-command']],
      ['Live service, payout, and recovery',['aefwg43-live-service']],
      ['Website queue, analytics, and restore visibility',['aefwg43-website-analytics']],
      ['Settings-side guided help',['aefwg43-settings-help']]
    ].map(([label, ids])=>({ label, ok: ids.some(id => progress[id] && progress[id].completedAt), ids }));
  }

  async function switchTab(tabId){ try{ if(typeof window.APP === 'object'){ APP.tab = tabId; } if(typeof window.render === 'function') await window.render(); }catch(_){} await wait(160); }
  function clearTarget(){ if(activeTarget){ activeTarget.classList.remove('aef-wg43-target'); activeTarget = null; } }
  function ensureStyle(){ if(document.getElementById('aeFlowWhiteGloveAcademyStylesV43')) return; const style = document.createElement('style'); style.id = 'aeFlowWhiteGloveAcademyStylesV43'; style.textContent = `.aef-wg43-target{position:relative !important; z-index:10012 !important; box-shadow:0 0 0 3px rgba(245,197,66,.95),0 0 0 9999px rgba(5,0,10,.54) !important; border-radius:16px !important;} .aef-wg43-overlay{position:fixed; inset:0; z-index:10011; pointer-events:none;} .aef-wg43-dock{position:fixed; right:16px; bottom:90px; width:min(430px,calc(100vw - 24px)); border:1px solid rgba(255,255,255,.14); border-radius:20px; background:linear-gradient(180deg, rgba(25,8,45,.96), rgba(10,4,20,.94)); box-shadow:0 26px 80px rgba(0,0,0,.48); padding:16px; color:rgba(255,255,255,.94); pointer-events:auto;} .aef-wg43-title{font-size:18px; font-weight:900; margin:0 0 6px;} .aef-wg43-body{font-size:13px; line-height:1.5; color:rgba(255,255,255,.80); white-space:pre-wrap;} .aef-wg43-progress{height:7px; border-radius:999px; background:rgba(255,255,255,.10); overflow:hidden; margin:14px 0 12px;} .aef-wg43-progress>i{display:block; height:100%; width:0; background:linear-gradient(90deg, rgba(245,197,66,.95), rgba(124,58,237,.92));} .aef-wg43-grid{display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:10px; margin-top:12px;} .aef-wg43-card{border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.04); border-radius:16px; padding:12px;} .aef-wg43-card h4{margin:0 0 6px; font-size:14px;} .aef-wg43-card p{margin:0 0 10px; font-size:12px; line-height:1.45; color:rgba(255,255,255,.72);} .aef-wg43-mini{font-size:11px; color:rgba(255,255,255,.62);} .aef-wg43-table{width:100%; border-collapse:collapse; margin-top:12px;} .aef-wg43-table th,.aef-wg43-table td{padding:8px; border-bottom:1px solid rgba(255,255,255,.08); text-align:left; vertical-align:top; font-size:12px;}`; document.head.appendChild(style); }
  function ensureOverlay(){ ensureStyle(); if(overlay) return overlay; overlay = document.createElement('div'); overlay.className = 'aef-wg43-overlay hidden'; overlay.id = 'aeFlowWhiteGloveTourOverlayV43'; overlay.innerHTML = `<div class="aef-wg43-dock"><div class="pill" id="aefWg43Meta">Step 1 / 1</div><h3 class="aef-wg43-title" id="aefWg43Title">AE FLOW white-glove walkthrough</h3><div class="aef-wg43-body" id="aefWg43Body"></div><div class="aef-wg43-progress"><i id="aefWg43Bar"></i></div><div class="row" style="flex-wrap:wrap; gap:8px;"><button class="btn small" id="aefWg43Back" type="button">Back</button><button class="btn small" id="aefWg43Next" type="button">Next</button><div class="spacer"></div><button class="btn small" id="aefWg43Hub" type="button">Fleet Academy</button><button class="btn small danger" id="aefWg43Close" type="button">Close</button></div></div>`; document.body.appendChild(overlay); document.getElementById('aefWg43Back').onclick = ()=> moveStep(-1); document.getElementById('aefWg43Next').onclick = ()=> moveStep(1); document.getElementById('aefWg43Hub').onclick = ()=> openCenter(); document.getElementById('aefWg43Close').onclick = ()=> closeTour(true); return overlay; }
  async function resolveTarget(step){ if(typeof step.getTarget === 'function'){ try{ return await step.getTarget(); }catch(_){ return null; } } if(!step.selector) return null; let el = null; for(let i=0;i<12;i++){ el = document.querySelector(step.selector); if(el) break; await wait(90); } return el; }
  async function highlight(step){ clearTarget(); const target = await resolveTarget(step || {}); if(target){ activeTarget = target; target.classList.add('aef-wg43-target'); target.scrollIntoView?.({ behavior:'smooth', block:'center', inline:'center' }); } }
  async function applyStep(){ if(!activeTour) return; const tour = getTours().find(t => t.id === activeTour.id); if(!tour) return; const step = tour.steps[activeTour.index]; if(!step) return; if(step.tab) await switchTab(step.tab); if(typeof step.before === 'function'){ try{ await step.before(); }catch(_){} } await highlight(step); ensureOverlay(); overlay.classList.remove('hidden'); document.getElementById('aefWg43Meta').textContent = 'Step ' + (activeTour.index + 1) + ' / ' + tour.steps.length; document.getElementById('aefWg43Title').textContent = step.title || tour.title; document.getElementById('aefWg43Body').textContent = step.body || ''; document.getElementById('aefWg43Bar').style.width = (((activeTour.index + 1) / tour.steps.length) * 100).toFixed(1) + '%'; document.getElementById('aefWg43Back').disabled = activeTour.index === 0; document.getElementById('aefWg43Next').textContent = activeTour.index === tour.steps.length - 1 ? 'Finish' : 'Next'; markProgress(activeTour.id, { inProgress:true, lastStep: activeTour.index + 1 }); injectButtons(); }
  async function moveStep(delta){ if(!activeTour) return; const tour = getTours().find(t => t.id === activeTour.id); if(!tour) return; const next = activeTour.index + delta; if(next < 0) return; if(next >= tour.steps.length){ markProgress(activeTour.id, { inProgress:false, completedAt:new Date().toISOString(), lastStep: tour.steps.length }); const queue = Array.isArray(activeTour.queue) ? activeTour.queue.slice() : []; closeTour(false); toast('White-glove walkthrough completed.','good'); if(queue.length){ await wait(140); startTour(queue[0], queue.slice(1)); } else openCenter(); return; } activeTour.index = next; await applyStep(); }
  function closeTour(reopen){ clearTarget(); if(overlay) overlay.classList.add('hidden'); if(activeTour){ markProgress(activeTour.id, { inProgress:false }); } activeTour = null; if(reopen) setTimeout(()=> openCenter(), 80); }
  function startTour(id, queue){ if(!getTours().find(t => t.id === id)) return; activeTour = { id, index:0, queue:Array.isArray(queue) ? queue : [] }; applyStep(); }
  function currentPageTourId(){ return (window.APP && APP.tab === 'settings') ? 'aefwg43-settings-help' : 'aefwg43-continuity'; }
  function centerHtml(){ const progress = readProgress(); const tours = getTours(); const done = tours.filter(t => progress[t.id] && progress[t.id].completedAt).length; const coverage = coverageRows(); return `<div class="hint">AE FLOW Fleet Academy extends the app with white-glove walkthroughs for continuity, booking command, live service visibility, analytics imports, and settings-side guided help.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap; gap:8px;"><div class="pill">Tours ${done}/${tours.length}</div><div class="pill">Coverage ${coverage.filter(r=>r.ok).length}/${coverage.length}</div><button class="btn" id="aefWg43PageGuide">Run page guide</button><button class="btn" id="aefWg43StartAll">Run all fleet tours</button></div><div class="sep"></div><h3 style="margin:0 0 8px;">Role mission packs</h3><div class="aef-wg43-grid">${getRolePacks().map(pack => `<div class="aef-wg43-card"><h4>${esc(pack.title)}</h4><p>${esc(pack.summary)}</p><div class="aef-wg43-mini">${pack.tours.length} guided passes</div><div class="sep"></div><button class="btn small" data-aef-wg43-pack="${esc(pack.id)}" type="button">Run pack</button></div>`).join('')}</div><div class="sep"></div><h3 style="margin:0 0 8px;">White-glove walkthrough library</h3><div class="aef-wg43-grid">${tours.map(t => `<div class="aef-wg43-card"><h4>${esc(t.title)}</h4><p>${esc(t.description)}</p><div class="aef-wg43-mini">${t.steps.length} screen-changing step(s) • ${progress[t.id] && progress[t.id].completedAt ? 'Completed' : 'Pending'}</div><div class="sep"></div><button class="btn small" data-aef-wg43-tour="${esc(t.id)}" type="button">Start walkthrough</button></div>`).join('')}</div><div class="sep"></div><h3 style="margin:0 0 8px;">Coverage matrix</h3><table class="aef-wg43-table"><thead><tr><th>Area</th><th>Status</th><th>Guided by</th></tr></thead><tbody>${coverage.map(row => `<tr><td>${esc(row.label)}</td><td>${row.ok ? 'Covered' : 'Needs guided pass'}</td><td>${row.ids.map(id => esc((tours.find(t => t.id === id) || {}).title || id)).join(', ')}</td></tr>`).join('')}</tbody></table>`; }
  function bindCenter(){ document.getElementById('aefWg43PageGuide')?.addEventListener('click', ()=>{ document.getElementById('modalClose')?.click(); startTour(currentPageTourId()); }); document.getElementById('aefWg43StartAll')?.addEventListener('click', ()=>{ document.getElementById('modalClose')?.click(); const ids = getTours().map(t => t.id); startTour(ids[0], ids.slice(1)); }); document.querySelectorAll('[data-aef-wg43-tour]').forEach(btn => btn.addEventListener('click', ()=>{ const id = btn.getAttribute('data-aef-wg43-tour'); document.getElementById('modalClose')?.click(); startTour(id); })); document.querySelectorAll('[data-aef-wg43-pack]').forEach(btn => btn.addEventListener('click', ()=>{ const pack = getRolePacks().find(p => p.id === btn.getAttribute('data-aef-wg43-pack')); if(!pack) return; document.getElementById('modalClose')?.click(); startTour(pack.tours[0], pack.tours.slice(1)); })); }
  function openCenter(){ if(typeof window.openModal === 'function'){ window.openModal('AE FLOW Fleet Academy', centerHtml(), '<button class="btn" onclick="document.getElementById(\'modalClose\').click()">Close</button>'); setTimeout(bindCenter, 0); } }
  function addGuideButton(cardSelector, id, label){ const card = document.querySelector(cardSelector); if(!card || card.querySelector('[data-aef-wg43-card="'+id+'"]')) return; const row = card.querySelector('.row:last-of-type') || card; const btn = document.createElement('button'); btn.className='btn small'; btn.textContent=label || 'Guide'; btn.setAttribute('data-aef-wg43-card', id); btn.onclick = ()=> startTour(id); row.appendChild(btn); }
  function injectButtons(){ const toolbar = document.querySelector('.toolbar') || document.querySelector('.row'); if(toolbar && !document.getElementById('aefWg43ToolbarBtn')){ const btn = document.createElement('button'); btn.id='aefWg43ToolbarBtn'; btn.className='btn small'; btn.textContent='Fleet tours'; btn.onclick = openCenter; toolbar.appendChild(btn); } const host = document.querySelector('#app') || document.body; if(host && !document.getElementById('aefWg43Launchpad') && window.APP && APP.tab === 'accounts'){ const card = document.createElement('div'); card.className='card'; card.id='aefWg43Launchpad'; const tours = getTours(); const progress = readProgress(); card.innerHTML = `<h2 style="margin:0 0 10px;">AE FLOW Fleet Academy</h2><div style="margin-bottom:12px;">Use these guided passes to learn the premium rider continuity stack, booking command lane, live service visibility, imported analytics, and settings-side help.</div><div class="row" style="flex-wrap:wrap; gap:8px;"><div class="pill">Completed ${tours.filter(t => progress[t.id] && progress[t.id].completedAt).length}/${tours.length}</div><button class="btn" id="aefWg43LaunchOpen">Open Fleet Academy</button><button class="btn" id="aefWg43LaunchPage">Run page guide</button></div>`; host.prepend(card); document.getElementById('aefWg43LaunchOpen')?.addEventListener('click', openCenter); document.getElementById('aefWg43LaunchPage')?.addEventListener('click', ()=> startTour(currentPageTourId())); } if(host && !document.getElementById('aefWg43SettingsCard') && window.APP && APP.tab === 'settings'){ const card = document.createElement('div'); card.className='card'; card.id='aefWg43SettingsCard'; card.innerHTML = `<h2 style="margin:0 0 10px;">White-glove walkthroughs and guided help</h2><div style="margin-bottom:12px;">Settings now includes the AE FLOW Fleet Academy so users can relaunch white-glove training from inside the app.</div><div class="row" style="flex-wrap:wrap; gap:8px;"><button class="btn" id="aefWg43SettingsOpen">Open Fleet Academy</button><button class="btn" id="aefWg43SettingsPage">Run settings guide</button></div>`; host.prepend(card); document.getElementById('aefWg43SettingsOpen')?.addEventListener('click', openCenter); document.getElementById('aefWg43SettingsPage')?.addEventListener('click', ()=> startTour('aefwg43-settings-help')); } addGuideButton('#aefV39WhiteGloveCard','aefwg43-continuity','Continuity guide'); addGuideButton('#aefWg40Card','aefwg43-booking-command','Command guide'); addGuideButton('#aefWg41Card','aefwg43-live-service','Live-service guide'); addGuideButton('#aefWg42Card','aefwg43-website-analytics','Visibility guide'); }
  const observer = new MutationObserver(()=> injectButtons()); observer.observe(document.documentElement || document.body, { childList:true, subtree:true }); const prevRender = window.render; if(typeof prevRender === 'function' && !window.__AEFLOW_WHITEGLOVE_RENDER_V43__){ window.__AEFLOW_WHITEGLOVE_RENDER_V43__ = true; window.render = async function(){ const out = await prevRender.apply(this, arguments); setTimeout(()=> injectButtons(), 0); return out; }; }
  window.openAEFlowWhiteGloveAcademyV43 = openCenter; window.startAEFlowWhiteGloveTourV43 = startTour; if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ()=> setTimeout(()=> injectButtons(), 120)); else setTimeout(()=> injectButtons(), 120);
})();
