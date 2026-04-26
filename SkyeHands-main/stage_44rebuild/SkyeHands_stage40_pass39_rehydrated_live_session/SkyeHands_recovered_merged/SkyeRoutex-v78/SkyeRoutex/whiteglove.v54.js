/* V54 Routex collision resolution + surface saturation + walkthrough saturation */
(function(){
  if(window.__ROUTEX_WHITEGLOVE_V54__) return;
  window.__ROUTEX_WHITEGLOVE_V54__ = true;
  const KEYS = {
    profiles:'skye_whiteglove_service_profiles_v39', bookings:'skye_whiteglove_bookings_v39', memberships:'skye_whiteglove_memberships_v39',
    proof:'skye_whiteglove_proof_packs_v44', acceptance:'skye_whiteglove_acceptance_runs_v45', conflicts:'skye_whiteglove_conflict_snapshots_v46',
    valuation:'skye_whiteglove_valuation_center_v52', chainAudits:'skye_whiteglove_route_chain_audits_v52', superdeck:'skye_whiteglove_superdeck_v52',
    surfaceBundles:'skye_whiteglove_surface_bundles_v53', collisionAudits:'skye_whiteglove_collision_audits_v53',
    resolutionPlans:'skye_whiteglove_collision_resolution_plans_v54', resolutionOutbox:'skye_whiteglove_collision_resolution_outbox_v54',
    saturationRows:'skye_whiteglove_surface_saturation_v54', saturationOutbox:'skye_whiteglove_surface_saturation_outbox_v54',
    ui:'skye_whiteglove_v54_ui'
  };
  const clean = (v)=> String(v == null ? '' : v).trim();
  const esc = (v)=> String(v == null ? '' : v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const iso = ()=> new Date().toISOString();
  const day = ()=> iso().slice(0,10);
  const uid = (p)=> (p || 'id') + '_' + Math.random().toString(36).slice(2,9) + '_' + Date.now().toString(36);
  const toast = window.toast || function(msg){ try{ console.log(msg); }catch(_){} };
  const downloadText = window.downloadText || function(content, filename, type){ const blob = new Blob([content], { type: type || 'text/plain' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename || 'download.txt'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=> URL.revokeObjectURL(url), 1200); };
  const readJSON = (k,f)=> { try{ const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : f; }catch(_){ return f; } };
  const writeJSON = (k,v)=> { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(_){} return v; };
  const rows = (key)=> readJSON(KEYS[key], []);
  const saveRows = (key, value)=> writeJSON(KEYS[key], Array.isArray(value) ? value : []);
  const latest = (key)=> rows(key)[0] || null;
  const pushRow = (key,row,limit)=> { const list = rows(key); list.unshift(row); saveRows(key, list.slice(0, limit || 240)); return row; };
  const getById = (key,id)=> rows(key).find(row => clean(row && row.id) === clean(id)) || null;
  const uiState = ()=> readJSON(KEYS.ui, { policy:'merge_newer', planId:'' });
  const setUI = (patch)=> writeJSON(KEYS.ui, Object.assign({}, uiState(), patch || {}));
  const money = (n)=> '$' + Number(n || 0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
  const htmlWrap = (title, row)=> '<!doctype html><html><head><meta charset="utf-8"><title>'+esc(title)+'</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}.wrap{max-width:1080px;margin:0 auto}.card{border:1px solid #ddd;border-radius:18px;padding:16px;white-space:pre-wrap}</style></head><body><div class="wrap"><div class="card"><h1>'+esc(title)+'</h1><pre>'+esc(JSON.stringify(row || {}, null, 2))+'</pre></div></div></body></html>';
  const compareIso = (a,b)=> { const aa = clean(a), bb = clean(b); if(!aa && !bb) return 0; if(!aa) return -1; if(!bb) return 1; return aa === bb ? 0 : (aa > bb ? 1 : -1); };
  function dedupeGroups(items, keyFn){
    const map = new Map();
    (items || []).forEach(item => {
      const key = clean(keyFn(item)).toLowerCase();
      if(!key) return;
      if(!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });
    return Array.from(map.entries()).filter(([, list]) => list.length > 1).map(([key, list]) => ({ key, rows:list }));
  }
  function chooseWinner(list){ return (list || []).slice().sort((a,b)=> compareIso(b.updatedAt || b.createdAt || b.savedAt, a.updatedAt || a.createdAt || a.savedAt))[0] || null; }
  function buildCollisionResolutionPreview(policy){
    policy = clean(policy || uiState().policy || 'merge_newer').toLowerCase();
    const profiles = rows('profiles');
    const bookings = rows('bookings');
    const memberships = rows('memberships');
    const actions = []; const blockers = [];
    const groups = dedupeGroups(profiles, row => [row.profileType, row.displayName || row.name, row.primaryPhone || row.phone, row.email].join('|'));
    groups.forEach(group => {
      const winner = chooseWinner(group.rows);
      const absorb = group.rows.filter(row => clean(row.id) !== clean(winner && winner.id));
      if(!winner || !absorb.length) return;
      actions.push({ id:uid('wg_resolve_action54'), type:'service_profile_merge', policy, survivorId:winner.id, absorbIds:absorb.map(row => row.id), key:group.key, note:'Repoint bookings and memberships to the newest matching profile and mark absorbed rows inactive.' });
    });
    bookings.forEach(booking => {
      if(clean(booking.serviceProfileId) && !profiles.some(row => clean(row.id) === clean(booking.serviceProfileId))){
        const matches = profiles.filter(row => clean(row.displayName || row.name) === clean(booking.serviceProfileName || booking.clientName || booking.profileName));
        if(matches.length === 1) actions.push({ id:uid('wg_resolve_action54'), type:'booking_profile_reattach', policy, bookingId:booking.id, targetProfileId:matches[0].id, note:'Reattach orphan booking to one uniquely matching stored profile.' });
        else blockers.push('booking_profile_orphan:' + booking.id);
      }
    });
    const duplicateBookings = dedupeGroups(bookings, row => [row.serviceProfileId, row.pickupAddress, row.dropoffAddress, row.etaWindow, row.serviceType].join('|'));
    duplicateBookings.forEach(group => actions.push({ id:uid('wg_resolve_action54'), type:'booking_review_only', policy, bookingIds:group.rows.map(row => row.id), note:'Booking duplicates remain review-only so the app does not auto-delete an active premium ride chain.' }));
    const plan = { id: uid('wg_resolution54'), createdAt: iso(), asOfDate: day(), fingerprint:'WG-RESOLVE-' + day().replace(/-/g,''), policy, ok:blockers.length === 0, blockers, actionCount:actions.length, profileMergeCount:actions.filter(r=>r.type==='service_profile_merge').length, bookingReattachCount:actions.filter(r=>r.type==='booking_profile_reattach').length, bookingReviewCount:actions.filter(r=>r.type==='booking_review_only').length, actions };
    pushRow('resolutionPlans', plan, 120); pushRow('resolutionOutbox', { id:uid('wg_resolution_out54'), createdAt:iso(), resolutionPlanId:plan.id }, 240); setUI({ planId: plan.id, policy }); return plan;
  }
  function applyCollisionResolution(planId){
    const plan = getById('resolutionPlans', planId || uiState().planId); if(!plan) return null;
    const profiles = rows('profiles').slice(); const bookings = rows('bookings').slice(); const memberships = rows('memberships').slice(); const applied = [];
    plan.actions.forEach(action => {
      if(action.type === 'service_profile_merge'){
        const survivorId = clean(action.survivorId); const absorbIds = (action.absorbIds || []).map(clean).filter(Boolean); if(!survivorId || !absorbIds.length) return;
        let bookingUpdates = 0, membershipUpdates = 0, profileUpdates = 0;
        bookings.forEach(row => { if(absorbIds.includes(clean(row.serviceProfileId))){ row.serviceProfileId = survivorId; row.updatedAt = iso(); row.resolutionNote = 'Merged duplicate profile chain into ' + survivorId; bookingUpdates += 1; } });
        memberships.forEach(row => { const key = clean(row.serviceProfileId || row.profileId); if(absorbIds.includes(key)){ row.serviceProfileId = survivorId; row.profileId = survivorId; row.updatedAt = iso(); row.resolutionNote = 'Merged duplicate profile chain into ' + survivorId; membershipUpdates += 1; } });
        profiles.forEach(row => { if(absorbIds.includes(clean(row.id))){ row.active = false; row.resolutionState = 'absorbed'; row.resolvedIntoId = survivorId; row.updatedAt = iso(); profileUpdates += 1; } });
        applied.push({ type:action.type, survivorId, bookingUpdates, membershipUpdates, profileUpdates });
      }
      if(action.type === 'booking_profile_reattach'){
        let count = 0;
        bookings.forEach(row => { if(clean(row.id) === clean(action.bookingId)){ row.serviceProfileId = clean(action.targetProfileId); row.updatedAt = iso(); row.resolutionNote = 'Reattached to profile ' + clean(action.targetProfileId); count += 1; } });
        applied.push({ type:action.type, bookingId:action.bookingId, targetProfileId:action.targetProfileId, count });
      }
    });
    saveRows('profiles', profiles); saveRows('bookings', bookings); saveRows('memberships', memberships);
    const result = { id:uid('wg_resolution_apply54'), createdAt:iso(), planId:plan.id, appliedCount:applied.length, applied, ok:true };
    pushRow('resolutionPlans', Object.assign({}, plan, { appliedAt: iso(), appliedResultId: result.id }), 120);
    pushRow('resolutionOutbox', { id:uid('wg_resolution_apply_out54'), createdAt:iso(), resolutionPlanId:plan.id, appliedResultId:result.id }, 240);
    return result;
  }
  function buildSurfaceSaturation(){
    const latestRows = { valuation:latest('valuation'), proof:latest('proof'), acceptance:latest('acceptance'), conflict:latest('conflicts'), chain:latest('chainAudits'), superdeck:latest('superdeck'), surface:latest('surfaceBundles'), collision:latest('collisionAudits'), resolution:latest('resolutionPlans') };
    const moduleFlags = { v39:!!window.__ROUTEX_WHITEGLOVE_V39__, v40:!!window.__ROUTEX_WHITEGLOVE_V40__, v41:!!window.__ROUTEX_WHITEGLOVE_V41__, v42:!!window.__ROUTEX_WHITEGLOVE_V42__, tour43:!!window.__ROUTEX_WHITEGLOVE_TOURS_V43__, v44:!!window.__ROUTEX_WHITEGLOVE_V44__, v45:!!window.__ROUTEX_WHITEGLOVE_V45__, v46:!!window.__ROUTEX_WHITEGLOVE_V46__, v47:!!window.__ROUTEX_WHITEGLOVE_V47__, v48:!!window.__ROUTEX_WHITEGLOVE_V48__, v50:!!window.__ROUTEX_WHITEGLOVE_V50__, v51:!!window.__ROUTEX_WHITEGLOVE_V51__, tour51:!!window.__ROUTEX_WHITEGLOVE_TOURS_V51__, v52:!!window.__ROUTEX_WHITEGLOVE_V52__, tour52:!!window.__ROUTEX_WHITEGLOVE_TOURS_V52__, v53:!!window.__ROUTEX_WHITEGLOVE_V53__, tour53:!!window.__ROUTEX_WHITEGLOVE_TOURS_V53__, v54:true };
    const surfaceFns = { hardeningCenter:typeof window.openWhiteGloveHardeningCenterV53==='function', resolutionCenter:typeof window.openWhiteGloveResolutionCenterV54==='function', guide:typeof window.startWhiteGloveV54Tour==='function' };
    const blockers = [];
    if(!latestRows.valuation) blockers.push('valuation_missing');
    if(!latestRows.proof) blockers.push('proof_missing');
    if(!latestRows.acceptance) blockers.push('acceptance_missing');
    if(!latestRows.chain || latestRows.chain.ok === false) blockers.push('route_chain_not_green');
    if(!latestRows.collision) blockers.push('collision_audit_missing');
    if(!latestRows.resolution) blockers.push('resolution_preview_missing');
    if(!surfaceFns.hardeningCenter || !surfaceFns.resolutionCenter || !surfaceFns.guide) blockers.push('visibility_or_guide_missing');
    const loadedCount = Object.values(moduleFlags).filter(Boolean).length;
    const row = { id:uid('wg_saturation54'), createdAt:iso(), fingerprint:'WG-SATURATION-' + day().replace(/-/g,''), ok:blockers.length===0, blockers, loadedCount, score:Math.max(0, 100 - blockers.length*9 + Math.min(10, loadedCount)), moduleFlags, surfaceFns, visibilityNotes:[ latestRows.surface ? 'Operator surface bundle exists.' : 'No operator surface bundle saved yet.', latestRows.superdeck ? 'Unified superdeck exists.' : 'Unified superdeck still missing.', latestRows.resolution ? ('Latest resolution plan has ' + latestRows.resolution.actionCount + ' actions.') : 'No collision-resolution preview saved yet.' ], valueView:latestRows.valuation ? money(latestRows.valuation.amountUsd || 0) : money(0) };
    pushRow('saturationRows', row, 120); pushRow('saturationOutbox', { id:uid('wg_saturation_out54'), createdAt:iso(), saturationId:row.id }, 240); return row;
  }
  function renderJsonCard(container,row){ container.textContent = row ? JSON.stringify(row, null, 2) : 'Nothing saved yet.'; }
  function ensureUI(){
    if(document.getElementById('wg-v54-launcher')) return;
    const launcher = document.createElement('button'); launcher.id = 'wg-v54-launcher'; launcher.textContent = 'WG Resolve+'; launcher.style.cssText = 'position:fixed;right:18px;bottom:120px;z-index:100009;border:1px solid rgba(255,255,255,.18);background:#173a2e;color:#fff;padding:10px 14px;border-radius:999px;font:700 12px system-ui;box-shadow:0 12px 28px rgba(0,0,0,.35);cursor:pointer;';
    const modal = document.createElement('div'); modal.id = 'wg-v54-modal'; modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:100010;background:rgba(0,0,0,.72);padding:24px;overflow:auto;';
    modal.innerHTML = '<div style="max-width:1220px;margin:0 auto;background:#08111e;color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:24px;padding:18px 18px 26px"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px"><div><div style="font:700 20px system-ui">White-glove resolution + saturation center</div><div style="font:12px system-ui;opacity:.72">Final hardening on duplicate collisions, booking reattach, and visibility saturation across the newest operator surfaces.</div></div><button id="wg-v54-close" style="border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#fff;padding:8px 12px;border-radius:12px;cursor:pointer">Close</button></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px"><section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h3 style="margin:0">Collision-resolution preview</h3><div><select id="wg-v54-policy" style="margin-right:8px"><option value="merge_newer">merge_newer</option><option value="keep_existing">keep_existing</option><option value="replace">replace</option></select><button id="wg-v54-preview" style="margin-right:8px">Preview</button><button id="wg-v54-apply" style="margin-right:8px">Apply</button><button id="wg-v54-export-plan-json">Export JSON</button></div></div><pre id="wg-v54-plan" style="white-space:pre-wrap;background:rgba(255,255,255,.04);padding:12px;border-radius:14px;max-height:280px;overflow:auto"></pre></section><section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">Surface saturation</h3><div><button id="wg-v54-build-saturation" style="margin-right:8px">Build</button><button id="wg-v54-export-saturation-html" style="margin-right:8px">Export HTML</button><button id="wg-v54-export-saturation-json">Export JSON</button></div></div><pre id="wg-v54-saturation" style="white-space:pre-wrap;background:rgba(255,255,255,.04);padding:12px;border-radius:14px;max-height:280px;overflow:auto"></pre></section><section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><h3 style="margin:0 0 10px">What this pass hardens</h3><div style="font:13px system-ui;line-height:1.6;opacity:.86">The plan focuses on the last ugly code-side edges: duplicate service-profile collisions, safe reattachment for orphan bookings, and proving that the newest value/proof/conflict/backend surfaces are all visible and teachable.</div><div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button id="wg-v54-run-guide">Run guide</button><button id="wg-v54-open-hardening">Open v53 hardening</button></div></section><section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><h3 style="margin:0 0 10px">Latest result snapshot</h3><pre id="wg-v54-result" style="white-space:pre-wrap;background:rgba(255,255,255,.04);padding:12px;border-radius:14px;max-height:220px;overflow:auto"></pre></section></div></div>';
    document.body.appendChild(launcher); document.body.appendChild(modal);
    const planPre = modal.querySelector('#wg-v54-plan'), satPre = modal.querySelector('#wg-v54-saturation'), resultPre = modal.querySelector('#wg-v54-result'), policySel = modal.querySelector('#wg-v54-policy');
    const refresh = ()=> { const state = uiState(); policySel.value = clean(state.policy || 'merge_newer'); renderJsonCard(planPre, latest('resolutionPlans')); renderJsonCard(satPre, latest('saturationRows')); renderJsonCard(resultPre, latest('resolutionPlans') && latest('resolutionPlans').appliedResultId ? { appliedResultId: latest('resolutionPlans').appliedResultId } : null); };
    launcher.onclick = ()=> { modal.style.display='block'; refresh(); };
    modal.querySelector('#wg-v54-close').onclick = ()=> { modal.style.display='none'; };
    policySel.onchange = ()=> setUI({ policy: policySel.value });
    modal.querySelector('#wg-v54-preview').onclick = ()=> { const row = buildCollisionResolutionPreview(policySel.value); renderJsonCard(planPre, row); toast(row.ok ? 'Collision-resolution preview saved.' : 'Collision-resolution preview saved with blockers.', row.ok ? 'good' : 'warn'); };
    modal.querySelector('#wg-v54-apply').onclick = ()=> { const result = applyCollisionResolution(uiState().planId); renderJsonCard(resultPre, result); toast(result ? 'Collision-resolution plan applied.' : 'No resolution plan available.', result ? 'good' : 'warn'); };
    modal.querySelector('#wg-v54-build-saturation').onclick = ()=> { const row = buildSurfaceSaturation(); renderJsonCard(satPre, row); toast(row.ok ? 'Surface saturation saved.' : 'Surface saturation saved with blockers.', row.ok ? 'good' : 'warn'); };
    modal.querySelector('#wg-v54-export-plan-json').onclick = ()=> downloadText(JSON.stringify(latest('resolutionPlans') || {}, null, 2), 'whiteglove_resolution_plan_v54.json', 'application/json');
    modal.querySelector('#wg-v54-export-saturation-html').onclick = ()=> downloadText(htmlWrap('White-glove surface saturation', latest('saturationRows')), 'whiteglove_surface_saturation_v54.html', 'text/html');
    modal.querySelector('#wg-v54-export-saturation-json').onclick = ()=> downloadText(JSON.stringify(latest('saturationRows') || {}, null, 2), 'whiteglove_surface_saturation_v54.json', 'application/json');
    modal.querySelector('#wg-v54-run-guide').onclick = ()=> { if(typeof window.startWhiteGloveV54Tour === 'function') window.startWhiteGloveV54Tour(); else toast('V54 guide unavailable.','warn'); };
    modal.querySelector('#wg-v54-open-hardening').onclick = ()=> { if(typeof window.openWhiteGloveHardeningCenterV53 === 'function') window.openWhiteGloveHardeningCenterV53(); else toast('Hardening center unavailable.','warn'); };
  }
  window.saveWhiteGloveCollisionResolutionPreviewV54 = buildCollisionResolutionPreview;
  window.applyWhiteGloveCollisionResolutionV54 = applyCollisionResolution;
  window.saveWhiteGloveSurfaceSaturationV54 = buildSurfaceSaturation;
  window.openWhiteGloveResolutionCenterV54 = function(){ ensureUI(); document.getElementById('wg-v54-launcher')?.click(); };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureUI); else ensureUI();
})();
