/* V55 Routex ambiguous duplicate-booking review + entrypoint saturation spread */
(function(){
  if(window.__ROUTEX_WHITEGLOVE_V55__) return;
  window.__ROUTEX_WHITEGLOVE_V55__ = true;
  const KEYS = {
    bookings:'skye_whiteglove_bookings_v39',
    duplicateReviewRows:'skye_whiteglove_duplicate_review_rows_v55',
    duplicateReviewOutbox:'skye_whiteglove_duplicate_review_outbox_v55',
    spreadRows:'skye_whiteglove_spread_rows_v55',
    spreadOutbox:'skye_whiteglove_spread_outbox_v55',
    ui:'skye_whiteglove_v55_ui'
  };
  const clean = (v)=> String(v == null ? '' : v).trim();
  const esc = (v)=> String(v == null ? '' : v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const iso = ()=> new Date().toISOString();
  const day = ()=> iso().slice(0,10);
  const uid = (p)=> (p || 'id') + '_' + Math.random().toString(36).slice(2,9) + '_' + Date.now().toString(36);
  const toast = window.toast || function(msg){ try{ console.log(msg); }catch(_){} };
  const readJSON = (k, f)=> { try{ const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : f; }catch(_){ return f; } };
  const writeJSON = (k, v)=> { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(_){} return v; };
  const rows = (key)=> readJSON(KEYS[key], []);
  const saveRows = (key, list)=> writeJSON(KEYS[key], Array.isArray(list) ? list : []);
  const latest = (key)=> rows(key)[0] || null;
  const pushRow = (key, row, limit)=> { const list = rows(key); list.unshift(row); saveRows(key, list.slice(0, limit || 300)); return row; };
  const uiState = ()=> readJSON(KEYS.ui, { reviewId:'', outcome:'mark_distinct' });
  const setUI = (patch)=> writeJSON(KEYS.ui, Object.assign({}, uiState(), patch || {}));
  const downloadText = window.downloadText || function(content, filename, type){ const blob = new Blob([content], { type: type || 'text/plain' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename || 'download.txt'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=> URL.revokeObjectURL(url), 1200); };
  const htmlWrap = (title, row)=> '<!doctype html><html><head><meta charset="utf-8"><title>'+esc(title)+'</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}.wrap{max-width:1080px;margin:0 auto}.card{border:1px solid #ddd;border-radius:18px;padding:16px;white-space:pre-wrap}</style></head><body><div class="wrap"><div class="card"><h1>'+esc(title)+'</h1><pre>'+esc(JSON.stringify(row || {}, null, 2))+'</pre></div></div></body></html>';
  function getBookings(){ return rows('bookings'); }
  function saveBookings(list){ return saveRows('bookings', list); }
  function groupPotentialDuplicateBookings(){
    const map = new Map();
    getBookings().forEach(row => {
      const key = [clean(row.serviceProfileId), clean(row.pickupAddress), clean(row.dropoffAddress), clean(row.serviceType), clean(row.etaWindow).slice(0,16)].join('|').toLowerCase();
      if(!key || key === '||||') return;
      if(!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    });
    const groups = [];
    map.forEach((list, key) => {
      if(list.length < 2) return;
      const statuses = Array.from(new Set(list.map(row => clean(row.dispatchStatus || row.status).toLowerCase()).filter(Boolean)));
      const primary = list.slice().sort((a,b) => clean(b.updatedAt || b.createdAt || '') > clean(a.updatedAt || a.createdAt || '') ? 1 : -1)[0];
      groups.push({
        id: uid('wg_dup_review55'),
        key,
        candidateCount: list.length,
        candidateBookingIds: list.map(row => row.id),
        candidateStatuses: statuses,
        activeCount: list.filter(row => ['confirmed','assigned','en_route','arrived','rider_boarded','in_service'].includes(clean(row.dispatchStatus || row.status).toLowerCase())).length,
        recommendedPrimaryBookingId: primary ? primary.id : '',
        recommendedOutcome: statuses.length > 1 ? 'operator_review' : 'cancel_duplicates',
        ambiguityLevel: statuses.length > 1 ? 'high' : (list.length > 2 ? 'medium' : 'low'),
        candidates: list.map(row => ({ bookingId: row.id, dispatchStatus: row.dispatchStatus || row.status || '', serviceProfileId: row.serviceProfileId || '', riderName: row.serviceProfileName || row.clientName || row.profileName || '', etaWindow: row.etaWindow || '', assignedDriverId: row.assignedDriverId || '', assignedVehicleId: row.assignedVehicleId || '', quotedTotal: row.pricingSnapshot && row.pricingSnapshot.quotedTotal || 0 }))
      });
    });
    return groups.sort((a,b) => b.candidateCount - a.candidateCount);
  }
  function buildDuplicateReviewPack(){
    const groups = groupPotentialDuplicateBookings();
    const blockers = groups.filter(g => g.ambiguityLevel === 'high').map(g => 'high_ambiguity_group:' + g.key);
    const row = { id: uid('wg_dup_pack55'), createdAt: iso(), asOfDate: day(), fingerprint: 'WG-DUP-REVIEW-' + day().replace(/-/g,''), ok: blockers.length === 0, blockers, groupCount: groups.length, highAmbiguityGroups: groups.filter(g => g.ambiguityLevel === 'high').length, groups };
    pushRow('duplicateReviewRows', row, 180);
    pushRow('duplicateReviewOutbox', { id: uid('wg_dup_review_out55'), createdAt: iso(), reviewPackId: row.id }, 240);
    setUI({ reviewId: row.id });
    return row;
  }
  function applyDuplicateReviewDisposition(reviewId, outcome, primaryBookingId){
    const pack = rows('duplicateReviewRows').find(row => clean(row.id) === clean(reviewId)) || latest('duplicateReviewRows');
    if(!pack) return null;
    const bookings = getBookings().slice();
    const applied = [];
    (pack.groups || []).forEach(group => {
      const candidates = (group.candidateBookingIds || []).map(id => clean(id)).filter(Boolean);
      const chosenPrimary = clean(primaryBookingId || group.recommendedPrimaryBookingId || candidates[0]);
      if(outcome === 'mark_distinct' || group.ambiguityLevel === 'high'){
        bookings.forEach(row => { if(candidates.includes(clean(row.id))){ row.duplicateReviewState = 'reviewed_distinct'; row.duplicateReviewId = pack.id; row.reviewedAt = iso(); } });
        applied.push({ groupKey: group.key, outcome:'mark_distinct', bookingIds:candidates });
        return;
      }
      if(outcome === 'cancel_duplicates'){
        bookings.forEach(row => {
          const id = clean(row.id);
          if(!candidates.includes(id)) return;
          row.duplicateReviewId = pack.id; row.reviewedAt = iso();
          if(id !== chosenPrimary){ row.dispatchStatus = 'cancelled_duplicate'; row.status = 'cancelled_duplicate'; row.linkedCanonicalBookingId = chosenPrimary; row.duplicateReviewState = 'cancelled_duplicate'; }
          else { row.duplicateReviewState = 'kept_primary'; }
        });
        applied.push({ groupKey: group.key, outcome:'cancel_duplicates', primaryBookingId: chosenPrimary, bookingIds:candidates });
      }
    });
    saveBookings(bookings);
    const result = { id: uid('wg_dup_apply55'), createdAt: iso(), reviewPackId: pack.id, outcome, primaryBookingId: clean(primaryBookingId), applied };
    pushRow('duplicateReviewOutbox', { id: uid('wg_dup_apply_out55'), createdAt: iso(), reviewPackId: pack.id, resultId: result.id, outcome }, 240);
    pushRow('duplicateReviewRows', Object.assign({}, pack, { appliedAt: iso(), appliedResult: result }), 180);
    return result;
  }
  function injectSpreadButton(target, id, label, handler){
    if(!target || document.getElementById(id)) return false;
    const btn = document.createElement('button');
    btn.id = id; btn.type = 'button'; btn.textContent = label;
    btn.style.cssText = 'border:1px solid rgba(255,255,255,.14);background:#16344f;color:#fff;padding:8px 12px;border-radius:12px;cursor:pointer;font:600 12px system-ui;';
    btn.addEventListener('click', handler); target.appendChild(btn); return true;
  }
  function trySpreadLaunchers(){
    const placements = [];
    const hooks = [
      { key:'header_actions', targets:['header .actions','.topbar .actions','.toolbar .actions','header','.topbar','.toolbar'] },
      { key:'settings_surface', targets:['#settings .actions','#settings','.settings-panel','.settings-card'] },
      { key:'academy_surface', targets:['#academy','.academy-panel','.academy-card'] },
      { key:'dashboard_surface', targets:['#dashboard .actions','#dashboard','.dashboard-grid','.dashboard-card'] }
    ];
    hooks.forEach(hook => {
      let placed = false;
      for(const selector of hook.targets){
        const target = document.querySelector(selector);
        if(!target) continue;
        const ok = injectSpreadButton(target, 'wg-v55-spread-' + hook.key, 'WG Review+', ()=> window.openWhiteGloveV55Center && window.openWhiteGloveV55Center());
        if(ok){ placements.push({ hook:hook.key, selector, state:'injected' }); placed = true; break; }
      }
      if(!placed) placements.push({ hook:hook.key, selector:'fallback_none', state:'missing_target' });
    });
    return placements;
  }
  function buildEntrypointSpread(){
    const placements = trySpreadLaunchers();
    const row = { id: uid('wg_spread55'), createdAt: iso(), asOfDate: day(), fingerprint: 'WG-SPREAD-' + day().replace(/-/g,''), ok: placements.some(p => p.state === 'injected'), placements, injectedCount: placements.filter(p => p.state === 'injected').length, missingCount: placements.filter(p => p.state !== 'injected').length, guideHookReady: typeof window.startWhiteGloveV55QuickGuide === 'function', centerReady: typeof window.openWhiteGloveV55Center === 'function' };
    pushRow('spreadRows', row, 180);
    pushRow('spreadOutbox', { id: uid('wg_spread_out55'), createdAt: iso(), spreadId: row.id }, 240);
    return row;
  }
  function renderJsonCard(node, value){ node.textContent = value ? JSON.stringify(value, null, 2) : 'Nothing saved yet.'; }
  function ensureUI(){
    if(document.getElementById('wg-v55-launcher')) return;
    const launcher = document.createElement('button'); launcher.id = 'wg-v55-launcher'; launcher.textContent = 'WG Finalize+'; launcher.style.cssText = 'position:fixed;right:18px;bottom:72px;z-index:100011;border:1px solid rgba(255,255,255,.18);background:#284a18;color:#fff;padding:10px 14px;border-radius:999px;font:700 12px system-ui;box-shadow:0 12px 28px rgba(0,0,0,.35);cursor:pointer;';
    const modal = document.createElement('div'); modal.id = 'wg-v55-modal'; modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:100012;background:rgba(0,0,0,.72);padding:24px;overflow:auto;';
    modal.innerHTML = '<div style="max-width:1240px;margin:0 auto;background:#08111e;color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:24px;padding:18px 18px 26px"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px"><div><div style="font:700 20px system-ui">White-glove duplicate review + saturation spread</div><div style="font:12px system-ui;opacity:.72">Final operator-reviewed duplicate-booking handling plus spread of the newest hardening surfaces into more entry points.</div></div><button id="wg-v55-close" style="border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#fff;padding:8px 12px;border-radius:12px;cursor:pointer">Close</button></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px"><section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h3 style="margin:0">Ambiguous duplicate-booking review</h3><div><select id="wg-v55-outcome" style="margin-right:8px"><option value="mark_distinct">mark_distinct</option><option value="cancel_duplicates">cancel_duplicates</option></select><button id="wg-v55-build-review" style="margin-right:8px">Build</button><button id="wg-v55-apply-review" style="margin-right:8px">Apply</button><button id="wg-v55-export-review-json">Export JSON</button></div></div><pre id="wg-v55-review" style="white-space:pre-wrap;background:rgba(255,255,255,.04);padding:12px;border-radius:14px;max-height:320px;overflow:auto"></pre></section><section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">Entrypoint spread saturation</h3><div><button id="wg-v55-build-spread" style="margin-right:8px">Build</button><button id="wg-v55-export-spread-html" style="margin-right:8px">Export HTML</button><button id="wg-v55-export-spread-json">Export JSON</button></div></div><pre id="wg-v55-spread" style="white-space:pre-wrap;background:rgba(255,255,255,.04);padding:12px;border-radius:14px;max-height:320px;overflow:auto"></pre></section><section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><h3 style="margin:0 0 10px">Quick actions</h3><div style="display:flex;gap:8px;flex-wrap:wrap"><button id="wg-v55-run-guide">Run v55 guide</button><button id="wg-v55-open-v54">Open v54 center</button><button id="wg-v55-open-v53">Open v53 hardening</button></div><div style="margin-top:12px;font:13px system-ui;line-height:1.6;opacity:.86">This pass avoids fake auto-resolution on ambiguous premium rides. It builds a review pack, lets the operator apply a deliberate outcome, then spreads launchers for the newest hardening/value surfaces into more entry points.</div></section><section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><h3 style="margin:0 0 10px">Latest apply result</h3><pre id="wg-v55-result" style="white-space:pre-wrap;background:rgba(255,255,255,.04);padding:12px;border-radius:14px;max-height:220px;overflow:auto"></pre></section></div></div>';
    document.body.appendChild(launcher); document.body.appendChild(modal);
    const reviewPre = modal.querySelector('#wg-v55-review'); const spreadPre = modal.querySelector('#wg-v55-spread'); const resultPre = modal.querySelector('#wg-v55-result'); const outcomeSel = modal.querySelector('#wg-v55-outcome');
    const refresh = ()=> { const state = uiState(); outcomeSel.value = clean(state.outcome || 'mark_distinct'); renderJsonCard(reviewPre, latest('duplicateReviewRows')); renderJsonCard(spreadPre, latest('spreadRows')); const latestReview = latest('duplicateReviewRows'); renderJsonCard(resultPre, latestReview && latestReview.appliedResult ? latestReview.appliedResult : null); };
    launcher.onclick = ()=> { modal.style.display='block'; refresh(); };
    modal.querySelector('#wg-v55-close').onclick = ()=> { modal.style.display='none'; };
    outcomeSel.onchange = ()=> setUI({ outcome: outcomeSel.value });
    modal.querySelector('#wg-v55-build-review').onclick = ()=> { const row = buildDuplicateReviewPack(); toast('White-glove duplicate review pack saved.'); renderJsonCard(reviewPre, row); };
    modal.querySelector('#wg-v55-apply-review').onclick = ()=> { const state = uiState(); const latestReview = latest('duplicateReviewRows'); const primary = latestReview && latestReview.groups && latestReview.groups[0] && latestReview.groups[0].recommendedPrimaryBookingId || ''; const result = applyDuplicateReviewDisposition(state.reviewId || (latestReview && latestReview.id), state.outcome || 'mark_distinct', primary); if(result){ toast('White-glove duplicate review applied.'); renderJsonCard(resultPre, result); renderJsonCard(reviewPre, latest('duplicateReviewRows')); } };
    modal.querySelector('#wg-v55-export-review-json').onclick = ()=> { const row = latest('duplicateReviewRows'); if(!row) return toast('Build a duplicate review pack first.'); downloadText(JSON.stringify(row,null,2), 'whiteglove-duplicate-review-v55.json', 'application/json'); };
    modal.querySelector('#wg-v55-build-spread').onclick = ()=> { const row = buildEntrypointSpread(); toast('Entrypoint spread report saved.'); renderJsonCard(spreadPre, row); };
    modal.querySelector('#wg-v55-export-spread-html').onclick = ()=> { const row = latest('spreadRows'); if(!row) return toast('Build a spread report first.'); downloadText(htmlWrap('White-glove entrypoint spread v55', row), 'whiteglove-entrypoint-spread-v55.html', 'text/html'); };
    modal.querySelector('#wg-v55-export-spread-json').onclick = ()=> { const row = latest('spreadRows'); if(!row) return toast('Build a spread report first.'); downloadText(JSON.stringify(row,null,2), 'whiteglove-entrypoint-spread-v55.json', 'application/json'); };
    modal.querySelector('#wg-v55-run-guide').onclick = ()=> { if(window.startWhiteGloveV55QuickGuide) window.startWhiteGloveV55QuickGuide(); };
    modal.querySelector('#wg-v55-open-v54').onclick = ()=> { if(window.openWhiteGloveV54Center) window.openWhiteGloveV54Center(); };
    modal.querySelector('#wg-v55-open-v53').onclick = ()=> { if(window.openWhiteGloveHardeningCenterV53) window.openWhiteGloveHardeningCenterV53(); };
  }
  window.buildWhiteGloveDuplicateReviewV55 = buildDuplicateReviewPack;
  window.applyWhiteGloveDuplicateReviewV55 = applyDuplicateReviewDisposition;
  window.buildWhiteGloveEntrypointSpreadV55 = buildEntrypointSpread;
  window.openWhiteGloveV55Center = function(){ ensureUI(); const launcher = document.getElementById('wg-v55-launcher'); if(launcher) launcher.click(); };
  window.startWhiteGloveV55QuickGuide = function(){ trySpreadLaunchers(); const steps = ['Open the v55 center and build the ambiguous duplicate-booking review pack.','Inspect high-ambiguity groups and keep them operator-reviewed.','Apply a deliberate disposition only where the chain is safe.','Build the entrypoint spread so the newest hardening surfaces are reachable from more places.','Run the older v53/v54 centers after this for cross-checking.']; toast('V55 guide: ' + steps[0]); window.openWhiteGloveV55Center(); setTimeout(()=> toast('V55 guide: ' + steps[1]), 900); setTimeout(()=> toast('V55 guide: ' + steps[2]), 1800); setTimeout(()=> toast('V55 guide: ' + steps[3]), 2700); setTimeout(()=> toast('V55 guide: ' + steps[4]), 3600); };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ()=> { ensureUI(); trySpreadLaunchers(); }); else { ensureUI(); trySpreadLaunchers(); }
})();
