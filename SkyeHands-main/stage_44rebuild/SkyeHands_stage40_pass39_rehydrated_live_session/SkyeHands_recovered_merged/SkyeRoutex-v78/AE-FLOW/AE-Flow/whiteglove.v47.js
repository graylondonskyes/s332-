/* V47 AE FLOW white-glove route-plan + profitability visibility */
(function(){
  if(window.__AEFLOW_WHITEGLOVE_V47__) return;
  window.__AEFLOW_WHITEGLOVE_V47__ = true;

  const SHARED = {
    profiles: 'skye_whiteglove_service_profiles_v39',
    bookings: 'skye_whiteglove_bookings_v39',
    docs: 'skye_whiteglove_docs_v39'
  };
  const ROUTEX = {
    routePlanOutbox: 'skye_whiteglove_route_plan_outbox_v47',
    routePlans: 'skye_whiteglove_route_plans_v47',
    profitabilityOutbox: 'skye_whiteglove_profitability_outbox_v47',
    profitability: 'skye_whiteglove_profitability_compare_v47',
    memberUsage: 'skye_whiteglove_member_usage_v47',
    incidentReports: 'skye_whiteglove_incident_reports_v47'
  };
  const KEYS = {
    planInbox: 'ae_whiteglove_route_plan_inbox_v47',
    profitInbox: 'ae_whiteglove_profit_inbox_v47',
    syncLog: 'ae_whiteglove_sync_log_v47'
  };

  const clean = (v)=> String(v == null ? '' : v).trim();
  const esc = (v)=> String(v == null ? '' : v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const uid = (p)=> (p || 'id') + '_' + Math.random().toString(36).slice(2,9) + '_' + Date.now().toString(36);
  const dayISO = ()=> new Date().toISOString().slice(0,10);
  const toast = window.toast || function(){};
  const downloadText = window.downloadText || function(content, filename, type){
    const blob = new Blob([content], { type: type || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename || 'download.txt'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=> URL.revokeObjectURL(url), 1200);
  };
  function readJSON(key, fallback){ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } }
  function writeJSON(key, value){ try{ localStorage.setItem(key, JSON.stringify(value)); }catch(_){ } return value; }
  const readPlanInbox = ()=> readJSON(KEYS.planInbox, []);
  const readProfitInbox = ()=> readJSON(KEYS.profitInbox, []);
  const readSyncLog = ()=> readJSON(KEYS.syncLog, []);
  const writePlanInbox = (rows)=> writeJSON(KEYS.planInbox, rows);
  const writeProfitInbox = (rows)=> writeJSON(KEYS.profitInbox, rows);
  const writeSyncLog = (rows)=> writeJSON(KEYS.syncLog, rows);
  const readProfiles = ()=> readJSON(SHARED.profiles, []);
  const readBookings = ()=> readJSON(SHARED.bookings, []);
  const readDocs = ()=> readJSON(SHARED.docs, []);

  function sync(){
    const planSource = readJSON(ROUTEX.routePlanOutbox, []);
    const profitSource = readJSON(ROUTEX.profitabilityOutbox, []);
    const planInbox = readPlanInbox();
    const profitInbox = readProfitInbox();
    const seenPlan = new Set(planInbox.map(row => row.id));
    const seenProfit = new Set(profitInbox.map(row => row.id));
    const addedPlans = planSource.filter(row => !seenPlan.has(row.id));
    const addedProfits = profitSource.filter(row => !seenProfit.has(row.id));
    if(addedPlans.length) writePlanInbox(addedPlans.concat(planInbox).slice(0, 300));
    if(addedProfits.length) writeProfitInbox(addedProfits.concat(profitInbox).slice(0, 300));
    const logs = readSyncLog();
    logs.unshift({ id: uid('ae_wg47_sync'), plans: addedPlans.length, profits: addedProfits.length, syncedAt: new Date().toISOString() });
    writeSyncLog(logs.slice(0, 300));
    return { plans: addedPlans.length, profits: addedProfits.length };
  }
  function latestSummary(){
    const docs = readDocs();
    const bookings = readBookings();
    const profiles = readProfiles();
    const latestPlanOutbox = readPlanInbox()[0] || null;
    const latestProfitOutbox = readProfitInbox()[0] || null;
    const latestPlan = latestPlanOutbox ? readJSON(ROUTEX.routePlans, []).find(row => clean(row.id) === clean(latestPlanOutbox.routePlanId)) : readJSON(ROUTEX.routePlans, [])[0] || null;
    const latestProfit = latestProfitOutbox ? readJSON(ROUTEX.profitability, []).find(row => clean(row.id) === clean(latestProfitOutbox.profitabilityId)) : readJSON(ROUTEX.profitability, [])[0] || null;
    return {
      bookings: bookings.length,
      profiles: profiles.length,
      memberUsageDocs: docs.filter(row => clean(row.type) === 'member_usage_summary_v47').length,
      incidentDocs: docs.filter(row => clean(row.type) === 'driver_incident_report_v47').length,
      memberUsageRows: readJSON(ROUTEX.memberUsage, []).length,
      incidentRows: readJSON(ROUTEX.incidentReports, []).length,
      latestPlan,
      latestProfit
    };
  }
  function buildHtml(summary){
    return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AE FLOW route-plan + profitability inbox</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}.wrap{max-width:1180px;margin:0 auto}.card{border:1px solid #ddd;border-radius:18px;padding:16px;margin:0 0 16px}.badge{display:inline-block;padding:4px 8px;border:1px solid #bbb;border-radius:999px;margin:0 6px 6px 0}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px">AE FLOW • Route-plan + profitability inbox</h1><div><span class="badge">Bookings '+esc(String(summary.bookings))+'</span><span class="badge">Profiles '+esc(String(summary.profiles))+'</span><span class="badge">Member usage docs '+esc(String(summary.memberUsageDocs))+'</span><span class="badge">Incident docs '+esc(String(summary.incidentDocs))+'</span></div></div><div class="card"><h2 style="margin:0 0 8px">Latest route plan</h2>'+(summary.latestPlan ? '<div><span class="badge">'+esc(summary.latestPlan.fingerprint || '—')+'</span><span class="badge">Legs '+esc(String(summary.latestPlan.legCount || 0))+'</span><span class="badge">Stops '+esc(String(summary.latestPlan.stopCount || 0))+'</span></div>' : '<div>No route plan visible yet.</div>')+'</div><div class="card"><h2 style="margin:0 0 8px">Latest profitability</h2>'+(summary.latestProfit ? '<div><span class="badge">Net $'+esc(Number(summary.latestProfit.estimatedNet || 0).toFixed(2))+'</span><span class="badge">Gross $'+esc(Number(summary.latestProfit.grossRevenue || 0).toFixed(2))+'</span></div>' : '<div>No profitability comparison visible yet.</div>')+'</div></div></body></html>';
  }
  function inject(){
    const existing = document.getElementById('aeWhiteGloveV47Card');
    if(existing) existing.remove();
    const summary = latestSummary();
    const host = document.querySelector('#routexWorkbenchHost') || document.querySelector('#app') || document.body;
    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'aeWhiteGloveV47Card';
    card.innerHTML = ''+
      '<h2 style="margin:0 0 10px">White-glove route-plan + profitability visibility</h2>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><button class="btn small" id="aeWg47SyncBtn">Sync route/profit lanes</button><button class="btn small" id="aeWg47ExportBtn">Export inbox HTML</button></div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">'+
        '<section style="border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:14px;background:rgba(255,255,255,.03)">'+
          '<h3 style="margin:0 0 8px">Latest Routex route plan</h3>'+
          (summary.latestPlan ? ('<div><span class="badge">'+esc(summary.latestPlan.fingerprint || '—')+'</span><span class="badge">Legs '+esc(String(summary.latestPlan.legCount || 0))+'</span><span class="badge">Return '+esc(summary.latestPlan.returnLeg ? 'yes' : 'no')+'</span></div>') : '<div>No route plan visible yet.</div>')+
        '</section>'+
        '<section style="border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:14px;background:rgba(255,255,255,.03)">'+
          '<h3 style="margin:0 0 8px">Latest profitability + compliance visibility</h3>'+
          (summary.latestProfit ? ('<div><span class="badge">Net $'+esc(Number(summary.latestProfit.estimatedNet || 0).toFixed(2))+'</span><span class="badge">Gross $'+esc(Number(summary.latestProfit.grossRevenue || 0).toFixed(2))+'</span><span class="badge">Payout $'+esc(Number(summary.latestProfit.payoutAmount || 0).toFixed(2))+'</span></div>') : '<div>No profitability comparison visible yet.</div>')+
          '<div style="margin-top:8px"><span class="badge">Member usage rows '+esc(String(summary.memberUsageRows))+'</span><span class="badge">Incident rows '+esc(String(summary.incidentRows))+'</span><span class="badge">Member usage docs '+esc(String(summary.memberUsageDocs))+'</span><span class="badge">Incident docs '+esc(String(summary.incidentDocs))+'</span></div>'+
        '</section>'+
      '</div>';
    host.appendChild(card);
    const bind = (id, fn)=> { const el = document.getElementById(id); if(el) el.onclick = fn; };
    bind('aeWg47SyncBtn', ()=>{ const res = sync(); toast('Route/profit lanes synced. Plans ' + res.plans + ', profits ' + res.profits + '.', (res.plans || res.profits) ? 'good' : 'warn'); inject(); });
    bind('aeWg47ExportBtn', ()=> downloadText(buildHtml(latestSummary()), 'ae_whiteglove_route_profit_inbox_' + dayISO() + '.html', 'text/html'));
  }
  const observer = new MutationObserver(()=> inject());
  observer.observe(document.body, { childList:true, subtree:true });
  const prevRender = window.renderAll;
  if(typeof prevRender === 'function') window.renderAll = function(){ const out = prevRender.apply(this, arguments); setTimeout(inject, 0); return out; };
  window.syncAEWhiteGloveRouteProfitV47 = sync;
})();
