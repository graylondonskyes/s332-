/* V38 Routex searchable academy, troubleshooting recipes, reports, and badges */
(function(){
  if(window.__ROUTEX_V38_ENABLEMENT__) return;
  window.__ROUTEX_V38_ENABLEMENT__ = true;

  const FULL_PROGRESS_KEY = 'skye_routex_tutorial_progress_v2';
  const MINI_PROGRESS_KEY = 'skye_routex_mini_progress_v1';
  const REPORTS_KEY = 'skye_routex_learning_reports_v38';
  const SEARCH_HISTORY_KEY = 'skye_routex_help_search_history_v38';

  const TOUR_ITEMS = [
    { id:'start-here', title:'Start here • Core navigation', keywords:'dashboard navigation start onboarding routes proof export settings', description:'Full first-use pass through the core Routex surfaces.' },
    { id:'route-ops', title:'Route ops • Build, run, close', keywords:'route route ops run close stops driver vehicle', description:'Guided run through creation, detail, proof, and pack support.' },
    { id:'artifact-mastery', title:'Artifact mastery • Proof, packets, exports', keywords:'proof packet export closure artifact import restore', description:'Shows the artifact surfaces that leave and re-enter the app.' },
    { id:'readiness-stack', title:'Readiness stack • Launch board, walkthrough, binder', keywords:'launch board binder walkthrough completion readiness', description:'Explains completion center, walkthrough receipt, and binder closeout.' },
    { id:'hybrid-sync', title:'Hybrid sync • Queues, sync, transparency', keywords:'hybrid queue sync outbox transparency queue hygiene', description:'Focused tour for hybrid queue visibility and cleanup.' },
    { id:'lineage-transfer', title:'Lineage and transfer proof', keywords:'legacy transfer capsule lineage compare portable recovery', description:'Covers lineage, capsules, and portable transfer flows.' },
    { id:'security-recovery', title:'Security and recovery', keywords:'pin backup encrypted backup import restore wipe recovery', description:'Security and recovery guidance for local deployments.' },
    { id:'bridge-and-packs', title:'Bridge and packs • AE FLOW to Routex', keywords:'ae flow bridge packs seeds trip packs', description:'Shows how Routex receives bridge context and pack support.' }
  ];
  const MINI_ITEMS = [
    { id:'mini-launch-board', title:'Micro guide • Launch board', keywords:'launch board blockers score next action readiness', description:'Fast read of readiness score, blockers, and next-action queue.' },
    { id:'mini-completion-binder', title:'Micro guide • Completion binder', keywords:'completion binder walkthrough receipt closeout', description:'Short guided pass for walkthrough receipt and final binder export.' },
    { id:'mini-hybrid-queue', title:'Micro guide • Hybrid queue hygiene', keywords:'hybrid queue sync clear stale queue cleanup', description:'Quick pass for queue sync, export, and cleanup.' },
    { id:'mini-import-restore', title:'Micro guide • Import and restore', keywords:'import restore recovery route pack import', description:'Shows the shortest path for recovery artifacts to re-enter the app.' },
    { id:'mini-proof-packet', title:'Micro guide • Proof packet', keywords:'proof packet closure export client-safe artifact', description:'Fast pass for client-safe proof and closure exports.' },
    { id:'mini-legacy-transfer', title:'Micro guide • Legacy and capsules', keywords:'legacy capsules lineage transfer compare', description:'Short proof of lineage, capsules, and portable recovery state.' }
  ];
  const ROLE_PACKS = [
    { id:'pack-operator', title:'Operator essentials badge', keywords:'operator essentials core', summary:'Core use, route ops, launch board, binder, and import safety.', items:[['tour','start-here'],['tour','route-ops'],['mini','mini-launch-board'],['mini','mini-completion-binder'],['mini','mini-import-restore']] },
    { id:'pack-closeout', title:'Proof and closeout badge', keywords:'proof closeout packet export', summary:'Artifact mastery, readiness stack, proof packet, and completion binder.', items:[['tour','artifact-mastery'],['tour','readiness-stack'],['mini','mini-proof-packet'],['mini','mini-completion-binder']] },
    { id:'pack-recovery', title:'Recovery and trust badge', keywords:'recovery trust backup restore lineage', summary:'Security, hybrid queue, import safety, and lineage portability.', items:[['tour','security-recovery'],['tour','hybrid-sync'],['tour','lineage-transfer'],['mini','mini-import-restore'],['mini','mini-legacy-transfer']] },
    { id:'pack-bridge', title:'Bridge and packs badge', keywords:'bridge packs ae flow', summary:'AE FLOW bridge context, packs, and queue-aware launch readiness.', items:[['tour','bridge-and-packs'],['mini','mini-launch-board'],['mini','mini-hybrid-queue']] }
  ];
  const RECIPES = [
    {
      id:'recipe-first-day',
      title:'Troubleshooting recipe • I am new and do not know where to start',
      keywords:'new first day start onboarding beginner help',
      symptom:'The product feels large and the operator needs the shortest safe starting path.',
      steps:['Run the core navigation tour first.','Immediately follow with route ops so the route lifecycle becomes concrete.','Open the launch board micro guide so readiness language starts making sense early.'],
      actions:[['tour','start-here','Start core tour'],['tour','route-ops','Start route ops'],['mini','mini-launch-board','Open launch board guide']]
    },
    {
      id:'recipe-proof-confusion',
      title:'Troubleshooting recipe • I do not understand proof and exported artifacts',
      keywords:'proof confusion packets exports closure artifact',
      symptom:'The operator can work inside the app but does not yet understand what leaves the product and why.',
      steps:['Open artifact mastery to see proof, exports, and restore as one story.','Run the proof packet micro guide for the shortest client-safe export explanation.'],
      actions:[['tour','artifact-mastery','Run artifact mastery'],['mini','mini-proof-packet','Open proof packet guide']]
    },
    {
      id:'recipe-readiness-red',
      title:'Troubleshooting recipe • My launch board is red or action required',
      keywords:'launch board red blockers readiness action required',
      symptom:'The product is warning about blockers and the operator needs a guided recovery path.',
      steps:['Open the launch board guide to understand score, blockers, and next actions.','Run readiness stack to see how walkthrough receipt and binder close the final gaps.'],
      actions:[['mini','mini-launch-board','Open launch board guide'],['tour','readiness-stack','Run readiness stack']]
    },
    {
      id:'recipe-hybrid-queue',
      title:'Troubleshooting recipe • My hybrid queue is confusing or stale',
      keywords:'hybrid queue stale sync cleanup confusing',
      symptom:'Pending queue state is visible but the operator is not sure which buttons matter first.',
      steps:['Run the hybrid queue micro guide for the shortest cleanup path.','Follow with the full hybrid sync tour if the queue still feels opaque.'],
      actions:[['mini','mini-hybrid-queue','Open hybrid queue guide'],['tour','hybrid-sync','Run hybrid sync tour']]
    },
    {
      id:'recipe-recovery',
      title:'Troubleshooting recipe • I need the safest recovery and restore path',
      keywords:'recovery restore import backup encrypted backup',
      symptom:'The operator wants backup, encrypted backup, import, and restore explained in the right order.',
      steps:['Run security and recovery for the full safety story.','Use the import and restore micro guide for the shortest hands-on path.'],
      actions:[['tour','security-recovery','Run security and recovery'],['mini','mini-import-restore','Open import and restore guide']]
    },
    {
      id:'recipe-lineage',
      title:'Troubleshooting recipe • I need lineage, legacy, or capsule clarity',
      keywords:'lineage legacy capsule compare transfer',
      symptom:'The operator needs to understand historical package proof and portable compare state.',
      steps:['Run lineage and transfer proof so the big picture is clear.','Use the legacy and capsules micro guide for the shortest focused pass.'],
      actions:[['tour','lineage-transfer','Run lineage and transfer'],['mini','mini-legacy-transfer','Open legacy and capsules guide']]
    },
    {
      id:'recipe-bridge',
      title:'Troubleshooting recipe • I need the AE FLOW bridge and pack story',
      keywords:'ae flow bridge packs seeds trip packs',
      symptom:'The operator wants the bridge surfaces explained without guessing which lane matters first.',
      steps:['Run bridge and packs so the Routex side sees the bridge story cleanly.','Use the route ops and launch board surfaces afterward for readiness context.'],
      actions:[['tour','bridge-and-packs','Run bridge and packs'],['tour','route-ops','Run route ops']]
    }
  ];

  const clean = (v)=> String(v == null ? '' : v).trim();
  const esc = (v)=> String(v == null ? '' : v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const toast = window.toast || function(){};

  function readJSON(key, fallback){
    try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; }
  }
  function writeJSON(key, value){ try{ localStorage.setItem(key, JSON.stringify(value)); }catch(_){} return value; }
  function readFull(){ return readJSON(FULL_PROGRESS_KEY, {}); }
  function readMini(){ return readJSON(MINI_PROGRESS_KEY, {}); }
  function readReports(){ return readJSON(REPORTS_KEY, []); }
  function saveReports(list){ return writeJSON(REPORTS_KEY, list || []); }
  function readSearchHistory(){ return readJSON(SEARCH_HISTORY_KEY, []); }
  function saveSearchHistory(list){ return writeJSON(SEARCH_HISTORY_KEY, list || []); }
  function dayISO(){ return new Date().toISOString().slice(0,10); }
  function uid(){ return 'rtx-v38-' + Math.random().toString(36).slice(2,10) + '-' + Date.now().toString(36); }

  function downloadText(text, filename, mime){
    try{
      if(typeof window.downloadText === 'function') return window.downloadText(text, filename, mime || 'text/plain');
    }catch(_){ }
    const blob = new Blob([String(text == null ? '' : text)], { type: mime || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename || ('download-' + Date.now() + '.txt');
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=> URL.revokeObjectURL(url), 500);
  }

  function readCombined(){
    const full = readFull();
    const mini = readMini();
    return { full, mini };
  }
  function itemDone(kind, id, maps){
    maps = maps || readCombined();
    const row = kind === 'tour' ? maps.full[id] : maps.mini[id];
    return !!(row && row.completedAt);
  }
  function badgeRows(){
    const maps = readCombined();
    return ROLE_PACKS.map(pack => {
      const total = pack.items.length;
      const done = pack.items.filter(([kind,id]) => itemDone(kind, id, maps)).length;
      const pct = Math.round((done / Math.max(1,total)) * 100);
      return {
        id: pack.id,
        title: pack.title,
        summary: pack.summary,
        total,
        done,
        pct,
        complete: done === total,
        state: done === total ? 'Unlocked' : (done ? 'In progress' : 'Locked')
      };
    });
  }
  function latestLearningRows(){
    const rows = [];
    const maps = readCombined();
    Object.entries(maps.full).forEach(([id,row])=> rows.push({ kind:'Tour', id, updatedAt:String((row||{}).updatedAt||''), done:!!(row&&row.completedAt) }));
    Object.entries(maps.mini).forEach(([id,row])=> rows.push({ kind:'Micro', id, updatedAt:String((row||{}).updatedAt||''), done:!!(row&&row.completedAt) }));
    return rows.filter(r => r.updatedAt).sort((a,b)=> b.updatedAt.localeCompare(a.updatedAt)).slice(0,10);
  }
  function buildReport(){
    const maps = readCombined();
    const toursDone = TOUR_ITEMS.filter(item => itemDone('tour', item.id, maps)).length;
    const minisDone = MINI_ITEMS.filter(item => itemDone('mini', item.id, maps)).length;
    const badges = badgeRows();
    const recent = latestLearningRows();
    const nextTour = TOUR_ITEMS.find(item => !itemDone('tour', item.id, maps));
    const nextMini = MINI_ITEMS.find(item => !itemDone('mini', item.id, maps));
    const overallTotal = TOUR_ITEMS.length + MINI_ITEMS.length;
    const overallDone = toursDone + minisDone;
    const pct = Math.round((overallDone / Math.max(1, overallTotal)) * 100);
    return {
      id: uid(),
      createdAt: new Date().toISOString(),
      source: 'routex-academy-v38',
      overall: { done: overallDone, total: overallTotal, pct },
      tours: { done: toursDone, total: TOUR_ITEMS.length },
      miniGuides: { done: minisDone, total: MINI_ITEMS.length },
      badges,
      nextSuggested: {
        nextTour: nextTour ? nextTour.title : 'All tours completed',
        nextMiniGuide: nextMini ? nextMini.title : 'All micro guides completed'
      },
      recentActivity: recent
    };
  }
  function saveReport(){
    const row = buildReport();
    const list = readReports().filter(item => clean(item && item.id) !== clean(row.id));
    list.unshift(row);
    saveReports(list.slice(0, 30));
    return row;
  }
  function reportHtml(row){
    row = row || buildReport();
    const badges = (row.badges || []).map(item => `<tr><td>${esc(item.title)}</td><td>${esc(String(item.done))}/${esc(String(item.total))}</td><td>${esc(String(item.pct))}%</td><td>${esc(item.state)}</td></tr>`).join('');
    const recent = (row.recentActivity || []).map(item => `<tr><td>${esc(item.kind)}</td><td>${esc(item.id)}</td><td>${item.done ? 'Completed' : 'In progress'}</td><td>${esc(item.updatedAt)}</td></tr>`).join('');
    return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Routex learning report</title><style>body{font-family:ui-sans-serif,system-ui;background:#05000a;color:#fff;padding:24px}.wrap{max-width:1040px;margin:0 auto}.card{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04);padding:18px;margin:0 0 18px}.badge{display:inline-block;padding:4px 8px;border:1px solid rgba(255,255,255,.16);border-radius:999px;margin:0 6px 6px 0}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px;">Routex • Learning completion report</h1><div><span class="badge">Overall ${esc(String(row.overall.pct))}%</span><span class="badge">Tours ${esc(String(row.tours.done))}/${esc(String(row.tours.total))}</span><span class="badge">Micro guides ${esc(String(row.miniGuides.done))}/${esc(String(row.miniGuides.total))}</span><span class="badge">Generated ${esc(row.createdAt)}</span></div><p style="margin:12px 0 0;">Next tour: ${esc(row.nextSuggested.nextTour)} • Next micro guide: ${esc(row.nextSuggested.nextMiniGuide)}</p></div><div class="card"><h2 style="margin:0 0 8px;">Role-pack badges</h2><table><thead><tr><th>Badge</th><th>Progress</th><th>Score</th><th>Status</th></tr></thead><tbody>${badges || '<tr><td colspan="4">No badge rows.</td></tr>'}</tbody></table></div><div class="card"><h2 style="margin:0 0 8px;">Recent learning activity</h2><table><thead><tr><th>Kind</th><th>ID</th><th>Status</th><th>Updated</th></tr></thead><tbody>${recent || '<tr><td colspan="4">No recent activity recorded yet.</td></tr>'}</tbody></table></div></div></body></html>`;
  }
  function exportReportJson(){ const row = saveReport(); downloadText(JSON.stringify(row, null, 2), 'routex_learning_report_' + dayISO() + '.json', 'application/json'); toast('Routex learning report JSON exported.', 'good'); }
  function exportReportHtml(){ const row = saveReport(); downloadText(reportHtml(row), 'routex_learning_report_' + dayISO() + '.html', 'text/html'); toast('Routex learning report HTML exported.', 'good'); }

  function buildSearchItems(){
    const items = [];
    TOUR_ITEMS.forEach(item => items.push({ kind:'tour', id:item.id, title:item.title, description:item.description, keywords:item.keywords }));
    MINI_ITEMS.forEach(item => items.push({ kind:'mini', id:item.id, title:item.title, description:item.description, keywords:item.keywords }));
    RECIPES.forEach(item => items.push({ kind:'recipe', id:item.id, title:item.title, description:item.symptom, keywords:item.keywords }));
    items.push({ kind:'action', id:'badges', title:'Role-pack badges board', description:'See which job packs are complete and what still unlocks them.', keywords:'badge board role packs status' });
    items.push({ kind:'action', id:'reports', title:'Learning completion report', description:'Export HTML or JSON completion reports for the learning stack.', keywords:'learning report export html json analytics' });
    return items;
  }
  function scoreItem(item, q){
    const hay = (item.title + ' ' + item.description + ' ' + item.keywords).toLowerCase();
    const terms = clean(q).toLowerCase().split(/\s+/).filter(Boolean);
    if(!terms.length) return 1;
    let score = 0;
    for(const term of terms){
      if(!hay.includes(term)) return 0;
      if(item.title.toLowerCase().includes(term)) score += 4;
      else if(item.keywords.toLowerCase().includes(term)) score += 2;
      else score += 1;
    }
    return score;
  }
  function filteredSearch(q){
    const items = buildSearchItems();
    const scored = items.map(item => ({ item, score: scoreItem(item, q) })).filter(row => row.score > 0).sort((a,b) => b.score - a.score || a.item.title.localeCompare(b.item.title));
    return scored.map(row => row.item).slice(0, 24);
  }
  function saveSearchTerm(q){
    q = clean(q);
    if(!q) return;
    const list = readSearchHistory().filter(item => clean(item) !== q);
    list.unshift(q);
    saveSearchHistory(list.slice(0, 12));
  }
  function runAction(kind, id){
    try{ document.getElementById('modalClose')?.click(); }catch(_){}
    if(kind === 'tour' && typeof window.startRoutexInteractiveTour === 'function') return window.startRoutexInteractiveTour(id);
    if(kind === 'mini' && typeof window.startRoutexMiniGuide === 'function') return window.startRoutexMiniGuide(id);
    if(kind === 'recipe') return openRecipes(id);
    if(kind === 'action' && id === 'badges') return openBadgeBoard();
    if(kind === 'action' && id === 'reports') return openReportBoard();
  }

  function bindSearchModal(){
    const input = document.getElementById('rtxV38SearchInput');
    const results = document.getElementById('rtxV38SearchResults');
    const chips = document.querySelectorAll('[data-rtx-v38-chip]');
    function render(q){
      const items = filteredSearch(q);
      results.innerHTML = items.length ? items.map(item => `<div class="rtx-v38-card"><h4>${esc(item.title)}</h4><p>${esc(item.description)}</p><div class="rtx-v38-mini">${esc(item.keywords)}</div><div class="sep"></div><button class="btn small" data-rtx-v38-run="${esc(item.kind)}::${esc(item.id)}">Open</button></div>`).join('') : '<div class="hint">No matching academy item yet.</div>';
      results.querySelectorAll('[data-rtx-v38-run]').forEach(btn => btn.onclick = ()=>{ const [kind,id] = String(btn.getAttribute('data-rtx-v38-run')||'').split('::'); if(clean(input.value)) saveSearchTerm(input.value); runAction(kind, id); });
    }
    input?.addEventListener('input', ()=> render(input.value));
    chips.forEach(chip => chip.onclick = ()=>{ if(input) input.value = chip.getAttribute('data-rtx-v38-chip') || ''; render(input.value || ''); });
    render(input && input.value || '');
  }
  function openSearch(prefill){
    const history = readSearchHistory();
    const seedChips = (history.length ? history : ['launch board','proof packet','recovery','hybrid queue','legacy capsules']).map(item => `<button class="btn small" type="button" data-rtx-v38-chip="${esc(item)}">${esc(item)}</button>`).join('');
    const body = `<div class="hint">Search every tour, micro guide, badge board, recipe, and report lane from one place. This makes the product easier to interrogate when the operator only knows the problem, not the right screen.</div><div class="sep"></div><input id="rtxV38SearchInput" class="input" placeholder="Search help, guides, or recipes" value="${esc(prefill || '')}"/><div class="sep"></div><div class="row" style="flex-wrap:wrap; gap:8px;">${seedChips}</div><div class="sep"></div><div class="rtx-v38-grid" id="rtxV38SearchResults"></div>`;
    openDialog('Routex help search', body, `<button class="btn" onclick="document.getElementById('modalClose').click()">Close</button>`);
    setTimeout(bindSearchModal, 0);
  }

  function recipeById(id){ return RECIPES.find(item => item.id === id) || null; }
  function bindRecipesModal(){
    document.querySelectorAll('[data-rtx-v38-recipe-action]').forEach(btn => btn.onclick = ()=>{
      const [kind,id] = String(btn.getAttribute('data-rtx-v38-recipe-action') || '').split('::');
      runAction(kind, id);
    });
    document.querySelectorAll('[data-rtx-v38-search-recipe]').forEach(btn => btn.onclick = ()=> openSearch(btn.getAttribute('data-rtx-v38-search-recipe')));
  }
  function openRecipes(focusId){
    const rows = (focusId ? RECIPES.filter(item => item.id === focusId) : RECIPES);
    const body = `<div class="hint">These troubleshooting recipes turn common confusion into a guided recovery move. Every recipe can launch the exact tour or micro guide that resolves the issue instead of only describing it.</div><div class="sep"></div><div class="rtx-v38-grid">${rows.map(item => `<div class="rtx-v38-card"><h4>${esc(item.title)}</h4><p>${esc(item.symptom)}</p><div class="rtx-v38-mini">${esc(item.keywords)}</div><div class="sep"></div><ul>${item.steps.map(step => `<li>${esc(step)}</li>`).join('')}</ul><div class="sep"></div><div class="row" style="flex-wrap:wrap; gap:8px;">${item.actions.map(row => `<button class="btn small" type="button" data-rtx-v38-recipe-action="${esc(row[0])}::${esc(row[1])}">${esc(row[2])}</button>`).join('')}<button class="btn small" type="button" data-rtx-v38-search-recipe="${esc(item.keywords.split(' ')[0] || item.title)}">Search related help</button></div></div>`).join('')}</div>`;
    openDialog('Routex troubleshooting recipes', body, `<button class="btn" onclick="document.getElementById('modalClose').click()">Close</button>`);
    setTimeout(bindRecipesModal, 0);
  }

  function openBadgeBoard(){
    const rows = badgeRows();
    const body = `<div class="hint">Role-pack badges let the product show exactly which operating packs are already learned and which still need guided coverage.</div><div class="sep"></div><div class="rtx-v38-grid">${rows.map(item => `<div class="rtx-v38-card"><h4>${esc(item.title)}</h4><p>${esc(item.summary)}</p><div class="row" style="flex-wrap:wrap; gap:8px;"><div class="pill">${esc(item.state)}</div><div class="pill">${esc(String(item.done))}/${esc(String(item.total))}</div><div class="pill">${esc(String(item.pct))}%</div></div></div>`).join('')}</div><div class="sep"></div><div class="row" style="flex-wrap:wrap; gap:8px;"><button class="btn" id="rtxV38ExportBadgeHtml">Export learning HTML</button><button class="btn" id="rtxV38ExportBadgeJson">Export learning JSON</button></div>`;
    openDialog('Routex badge board', body, `<button class="btn" onclick="document.getElementById('modalClose').click()">Close</button>`);
    setTimeout(()=>{
      document.getElementById('rtxV38ExportBadgeHtml')?.addEventListener('click', exportReportHtml);
      document.getElementById('rtxV38ExportBadgeJson')?.addEventListener('click', exportReportJson);
    }, 0);
  }

  function openReportBoard(){
    const reports = readReports();
    const latest = reports[0] || buildReport();
    const rows = reports.length ? reports.map(item => `<tr><td>${esc(item.createdAt)}</td><td>${esc(String((item.overall||{}).pct || 0))}%</td><td>${esc(String(((item.badges||[]).filter(r => r.complete).length)))} complete badge(s)</td></tr>`).join('') : '<tr><td colspan="3">No saved report rows yet. Export one now.</td></tr>';
    const body = `<div class="hint">Learning completion reports make the education layer visible, exportable, and auditable without leaving the product.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap; gap:8px;"><div class="pill">Overall ${esc(String((latest.overall||{}).pct || 0))}%</div><div class="pill">Tours ${esc(String(((latest.tours||{}).done || 0)))} / ${esc(String(((latest.tours||{}).total || 0)))}</div><div class="pill">Micro guides ${esc(String(((latest.miniGuides||{}).done || 0)))} / ${esc(String(((latest.miniGuides||{}).total || 0)))}</div></div><div class="sep"></div><table class="rtx-v38-table"><thead><tr><th>Generated</th><th>Overall</th><th>Badge state</th></tr></thead><tbody>${rows}</tbody></table><div class="sep"></div><div class="row" style="flex-wrap:wrap; gap:8px;"><button class="btn" id="rtxV38ExportLearningHtml">Export report HTML</button><button class="btn" id="rtxV38ExportLearningJson">Export report JSON</button></div>`;
    openDialog('Routex learning reports', body, `<button class="btn" onclick="document.getElementById('modalClose').click()">Close</button>`);
    setTimeout(()=>{
      document.getElementById('rtxV38ExportLearningHtml')?.addEventListener('click', exportReportHtml);
      document.getElementById('rtxV38ExportLearningJson')?.addEventListener('click', exportReportJson);
    }, 0);
  }

  function openDialog(title, body, footer){
    if(typeof window.openModal === 'function') return window.openModal(title, body, footer || `<button class="btn" onclick="document.getElementById('modalClose').click()">Close</button>`);
    const wrap = document.createElement('div');
    wrap.id = 'modalWrap';
    wrap.innerHTML = `<div style="position:fixed;inset:0;background:rgba(0,0,0,.66);z-index:99999;display:flex;align-items:center;justify-content:center;padding:18px;"><div style="max-width:940px;width:100%;max-height:86vh;overflow:auto;background:#13071f;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:18px;"><div class="row" style="justify-content:space-between;gap:12px;"><h2 style="margin:0;">${esc(title)}</h2><button class="btn" id="modalClose" type="button">Close</button></div><div id="modalBody">${body}</div><div style="margin-top:12px;">${footer || ''}</div></div></div>`;
    document.body.appendChild(wrap);
    document.getElementById('modalClose')?.addEventListener('click', ()=> wrap.remove());
  }

  function ensureStyle(){
    if(document.getElementById('rtxV38EnablementStyles')) return;
    const style = document.createElement('style');
    style.id = 'rtxV38EnablementStyles';
    style.textContent = `.rtx-v38-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px}.rtx-v38-card{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);border-radius:16px;padding:12px}.rtx-v38-card h4{margin:0 0 6px;font-size:14px}.rtx-v38-card p{margin:0 0 8px;font-size:12px;line-height:1.45;color:rgba(255,255,255,.76)}.rtx-v38-mini{font-size:11px;color:rgba(255,255,255,.58)}.rtx-v38-table{width:100%;border-collapse:collapse}.rtx-v38-table th,.rtx-v38-table td{padding:8px;border-bottom:1px solid rgba(255,255,255,.08);text-align:left;vertical-align:top;font-size:12px}.rtx-v38-quick{margin-top:12px}`;
    document.head.appendChild(style);
  }
  function dashboardCardHtml(){
    const badges = badgeRows();
    const completeBadges = badges.filter(item => item.complete).length;
    return `<h2>Searchable academy and troubleshooting</h2><div class="hint">Search every tour and micro guide, open fix recipes, export learning reports, and track role-pack badges from one visible command lane.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap; gap:8px;"><div class="pill">Badges ${esc(String(completeBadges))}/${esc(String(badges.length))}</div><div class="pill">Reports ${esc(String(readReports().length))}</div><button class="btn" id="rtxV38CardSearch">Search help</button><button class="btn" id="rtxV38CardRecipes">Fix recipes</button><button class="btn" id="rtxV38CardReports">Learning reports</button></div>`;
  }
  function bindCardButtons(){
    document.getElementById('rtxV38CardSearch')?.addEventListener('click', ()=> openSearch(''));
    document.getElementById('rtxV38CardRecipes')?.addEventListener('click', ()=> openRecipes(''));
    document.getElementById('rtxV38CardReports')?.addEventListener('click', openReportBoard);
  }
  function inject(){
    ensureStyle();
    const host = document.querySelector('.topbar .row:last-of-type') || document.querySelector('.topbar .row') || document.querySelector('.toolbar') || document.querySelector('.row');
    if(host && !document.getElementById('rtxV38SearchBtn')){
      const searchBtn = document.createElement('button'); searchBtn.className='btn'; searchBtn.id='rtxV38SearchBtn'; searchBtn.textContent='Help Search'; searchBtn.onclick = ()=> openSearch('');
      const recipeBtn = document.createElement('button'); recipeBtn.className='btn'; recipeBtn.id='rtxV38RecipeBtn'; recipeBtn.textContent='Fix Recipes'; recipeBtn.onclick = ()=> openRecipes('');
      const reportBtn = document.createElement('button'); reportBtn.className='btn'; reportBtn.id='rtxV38ReportBtn'; reportBtn.textContent='Learning Reports'; reportBtn.onclick = openReportBoard;
      const badgeBtn = document.createElement('button'); badgeBtn.className='btn'; badgeBtn.id='rtxV38BadgeBtn'; badgeBtn.textContent='Badge Board'; badgeBtn.onclick = openBadgeBoard;
      host.appendChild(searchBtn); host.appendChild(recipeBtn); host.appendChild(reportBtn); host.appendChild(badgeBtn);
    }
    const grid = document.querySelector('#content .grid') || document.querySelector('.grid');
    if(grid && window.APP && APP.view === 'dashboard' && !document.getElementById('rtxV38DashboardHelpCard')){
      const card = document.createElement('div');
      card.className = 'card'; card.id = 'rtxV38DashboardHelpCard'; card.style.gridColumn = 'span 12';
      card.innerHTML = dashboardCardHtml();
      grid.insertBefore(card, grid.firstChild);
      bindCardButtons();
    }
    if(grid && window.APP && APP.view === 'settings' && !document.getElementById('rtxV38SettingsHelpCard')){
      const card = document.createElement('div');
      card.className = 'card'; card.id = 'rtxV38SettingsHelpCard'; card.style.gridColumn = 'span 12';
      card.innerHTML = `<h2>Academy command lane</h2><div class="hint">This settings card keeps help search, troubleshooting recipes, reports, and role-pack badges visible inside the control surface.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap; gap:8px;"><button class="btn" id="rtxV38SettingsSearch">Search help</button><button class="btn" id="rtxV38SettingsRecipes">Open recipes</button><button class="btn" id="rtxV38SettingsReports">Export reports</button><button class="btn" id="rtxV38SettingsBadges">View badges</button></div>`;
      grid.insertBefore(card, grid.firstChild);
      document.getElementById('rtxV38SettingsSearch')?.addEventListener('click', ()=> openSearch(''));
      document.getElementById('rtxV38SettingsRecipes')?.addEventListener('click', ()=> openRecipes(''));
      document.getElementById('rtxV38SettingsReports')?.addEventListener('click', openReportBoard);
      document.getElementById('rtxV38SettingsBadges')?.addEventListener('click', openBadgeBoard);
    }
  }

  const observer = new MutationObserver(()=> inject());
  observer.observe(document.documentElement || document.body, { childList:true, subtree:true });
  const prevRender = window.render;
  if(typeof prevRender === 'function' && !window.__ROUTEX_V38_RENDER_WRAPPED__){
    window.__ROUTEX_V38_RENDER_WRAPPED__ = true;
    window.render = async function(){ const out = await prevRender.apply(this, arguments); setTimeout(inject, 0); return out; };
  }
  window.openRoutexAcademySearch = openSearch;
  window.openRoutexTroubleshootingRecipes = openRecipes;
  window.openRoutexLearningReports = openReportBoard;
  window.openRoutexBadgeBoard = openBadgeBoard;
  window.exportRoutexLearningReportHtml = exportReportHtml;
  window.exportRoutexLearningReportJson = exportReportJson;
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ()=> setTimeout(inject, 120));
  else setTimeout(inject, 120);
})();
