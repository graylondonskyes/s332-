
/* V57 Routex client transparency packet + member statement center */
(function(){
  if(window.__ROUTEX_WHITEGLOVE_V57__) return;
  window.__ROUTEX_WHITEGLOVE_V57__ = true;
  const STORAGE = {
    profiles:'skye_whiteglove_service_profiles_v39',
    memberships:'skye_whiteglove_memberships_v39',
    bookings:'skye_whiteglove_bookings_v39',
    docs:'skye_whiteglove_docs_v39',
    packets:'skye_whiteglove_client_packets_v57',
    packetOutbox:'skye_whiteglove_client_packet_outbox_v57',
    statements:'skye_whiteglove_member_statements_v57',
    statementOutbox:'skye_whiteglove_member_statement_outbox_v57'
  };
  const clean = (v)=> String(v == null ? '' : v).trim();
  const esc = (v)=> String(v == null ? '' : v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const iso = ()=> new Date().toISOString();
  const day = ()=> iso().slice(0,10);
  const uid = (p)=> (p || 'id') + '_' + Math.random().toString(36).slice(2,9) + '_' + Date.now().toString(36);
  const toast = window.toast || function(msg){ try{ console.log(msg); }catch(_){} };
  const readJSON = (k, f)=> { try{ const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : f; }catch(_){ return f; } };
  const writeJSON = (k, v)=> { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(_){} return v; };
  const rows = (key)=> readJSON(STORAGE[key], []);
  const saveRows = (key, list)=> writeJSON(STORAGE[key], Array.isArray(list) ? list : []);
  const latest = (key)=> rows(key)[0] || null;
  const pushRow = (key, row, limit)=> { const list = rows(key); list.unshift(row); saveRows(key, list.slice(0, limit || 240)); return row; };
  const downloadText = window.downloadText || function(content, filename, type){ const blob = new Blob([content], { type: type || 'text/plain' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename || 'download.txt'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=> URL.revokeObjectURL(url), 1200); };
  const money = (n)=> '$' + Number(n || 0).toFixed(2);
  const getBookings = ()=> rows('bookings');
  const getProfiles = ()=> rows('profiles');
  const getMemberships = ()=> rows('memberships');
  const getDocs = ()=> rows('docs');
  function findProfile(id){ return getProfiles().find(row => clean(row.id) === clean(id)) || null; }
  function findMembership(id){ return getMemberships().find(row => clean(row.id) === clean(id)) || null; }
  function latestBooking(){ return getBookings().find(Boolean) || null; }
  function docsForBooking(id){ return getDocs().filter(row => clean(row.bookingId || row.recordId) === clean(id)); }
  function packetHtml(row){
    const booking = row.booking || {}; const profile = row.profile || {}; const membership = row.membership || {};
    const docs = row.docSummary || [];
    const cards = docs.map(doc => '<li><strong>' + esc(doc.type || 'doc') + '</strong> — ' + esc(doc.title || doc.label || 'Untitled') + '</li>').join('');
    return '<!doctype html><html><head><meta charset="utf-8"><title>Client transparency packet</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}.wrap{max-width:1120px;margin:0 auto}.card{border:1px solid #ddd;border-radius:18px;padding:16px;margin:0 0 16px}.badge{display:inline-block;padding:5px 9px;border:1px solid #999;border-radius:999px;margin:0 8px 8px 0}</style></head><body><div class="wrap"><div class="card"><h1>White-glove Client Transparency Packet</h1><div><span class="badge">Packet ' + esc(row.id) + '</span><span class="badge">Booking ' + esc(booking.id || '—') + '</span><span class="badge">Status ' + esc(booking.dispatchStatus || booking.status || '—') + '</span></div><p><strong>Client:</strong> ' + esc(profile.displayName || booking.serviceProfileName || '—') + '<br><strong>Service type:</strong> ' + esc(booking.serviceType || '—') + '<br><strong>Market:</strong> ' + esc(booking.market || '—') + '<br><strong>Window:</strong> ' + esc(booking.etaWindow || '—') + '</p><p><strong>Pickup:</strong> ' + esc(booking.pickupAddress || '—') + '<br><strong>Dropoff:</strong> ' + esc(booking.dropoffAddress || '—') + '</p><p><strong>Quoted total:</strong> ' + money(booking.pricingSnapshot && booking.pricingSnapshot.quotedTotal || 0) + '<br><strong>Favorite driver state:</strong> ' + esc(booking.favoriteDriverState || '—') + '<br><strong>Membership linked:</strong> ' + esc(membership.id || 'No') + '</p></div><div class="card"><h2>What this packet includes</h2><ul><li>Canonical booking summary</li><li>Client/service profile linkage</li><li>Membership visibility when applicable</li><li>Document chain summary</li><li>Service transparency notes for operator/client review</li>' + cards + '</ul></div><div class="card"><pre>' + esc(JSON.stringify(row, null, 2)) + '</pre></div></div></body></html>';
  }
  function statementHtml(row){
    const membership = row.membership || {}; const profile = row.profile || {}; const usage = row.usage || {};
    return '<!doctype html><html><head><meta charset="utf-8"><title>Member statement</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}.wrap{max-width:980px;margin:0 auto}.card{border:1px solid #ddd;border-radius:18px;padding:16px;margin:0 0 16px}.badge{display:inline-block;padding:5px 9px;border:1px solid #999;border-radius:999px;margin:0 8px 8px 0}</style></head><body><div class="wrap"><div class="card"><h1>White-glove Member Statement</h1><div><span class="badge">Statement ' + esc(row.id) + '</span><span class="badge">Membership ' + esc(membership.id || '—') + '</span><span class="badge">Plan ' + esc(membership.planType || '—') + '</span></div><p><strong>Client:</strong> ' + esc(profile.displayName || '—') + '<br><strong>Status:</strong> ' + esc(membership.status || '—') + '<br><strong>Created:</strong> ' + esc(membership.createdAt || '—') + '</p><p><strong>Included hours:</strong> ' + esc(String(membership.includedHours ?? '—')) + '<br><strong>Remaining hours:</strong> ' + esc(String(membership.remainingHours ?? '—')) + '<br><strong>Included miles:</strong> ' + esc(String(membership.includedMiles ?? '—')) + '<br><strong>Remaining miles:</strong> ' + esc(String(membership.remainingMiles ?? '—')) + '</p></div><div class="card"><h2>Usage summary</h2><p><strong>Draw count:</strong> ' + esc(String(usage.drawCount || 0)) + '<br><strong>Total hours used:</strong> ' + esc(String(usage.hoursUsed || 0)) + '<br><strong>Total miles used:</strong> ' + esc(String(usage.milesUsed || 0)) + '</p></div><div class="card"><pre>' + esc(JSON.stringify(row, null, 2)) + '</pre></div></div></body></html>';
  }
  function buildClientTransparencyPacket(bookingId){
    const booking = bookingId ? (getBookings().find(row => clean(row.id) === clean(bookingId)) || null) : latestBooking();
    if(!booking) return null;
    const profile = findProfile(booking.serviceProfileId) || {};
    const membership = booking.membershipId ? (findMembership(booking.membershipId) || {}) : {};
    const docSummary = docsForBooking(booking.id).map(row => ({ id:row.id, type:row.type || row.docType || '', title:row.title || row.label || '' }));
    const packet = {
      id: uid('wg_client_packet57'), createdAt: iso(), asOfDate: day(),
      booking, profile, membership,
      docSummary,
      transparency: {
        requestSource: booking.requestSource || '',
        dispatchStatus: booking.dispatchStatus || booking.status || '',
        favoriteDriverState: booking.favoriteDriverState || '',
        routeMaterialized: !!booking.routeMaterialized,
        routeLegCount: Number(booking.routeLegCount || 0),
        routeStopCount: Number(booking.routeStopCount || 0),
        quotedTotal: Number(booking.pricingSnapshot && booking.pricingSnapshot.quotedTotal || 0)
      }
    };
    pushRow('packets', packet, 240);
    pushRow('packetOutbox', { id: uid('wg_client_packet_out57'), createdAt: iso(), packetId: packet.id, bookingId: booking.id }, 320);
    return packet;
  }
  function buildMemberStatement(membershipId){
    const membership = membershipId ? (findMembership(membershipId) || null) : (getMemberships()[0] || null);
    if(!membership) return null;
    const profile = findProfile(membership.serviceProfileId) || {};
    const bookings = getBookings().filter(row => clean(row.membershipId) === clean(membership.id));
    const usage = bookings.reduce((acc, row) => {
      acc.drawCount += 1;
      acc.hoursUsed += Number((row.finalEconomics && row.finalEconomics.memberHoursUsed) || row.memberHoursUsed || 0);
      acc.milesUsed += Number((row.finalEconomics && row.finalEconomics.memberMilesUsed) || row.memberMilesUsed || 0);
      return acc;
    }, { drawCount:0, hoursUsed:0, milesUsed:0 });
    const statement = { id: uid('wg_member_statement57'), createdAt: iso(), asOfDate: day(), membership, profile, usage, bookingCount: bookings.length, linkedBookingIds: bookings.map(row => row.id) };
    pushRow('statements', statement, 240);
    pushRow('statementOutbox', { id: uid('wg_member_statement_out57'), createdAt: iso(), statementId: statement.id, membershipId: membership.id }, 320);
    return statement;
  }
  function render(node, value){ node.textContent = value ? JSON.stringify(value, null, 2) : 'Nothing built yet.'; }
  function ensureUI(){
    if(document.getElementById('wg-v57-launcher')) return;
    const launcher = document.createElement('button');
    launcher.id='wg-v57-launcher'; launcher.textContent='WG Client Pack';
    launcher.style.cssText='position:fixed;right:18px;bottom:248px;z-index:100019;border:1px solid rgba(255,255,255,.18);background:#4d2d0e;color:#fff;padding:10px 14px;border-radius:999px;font:700 12px system-ui;cursor:pointer;';
    const modal = document.createElement('div');
    modal.id='wg-v57-modal';
    modal.style.cssText='display:none;position:fixed;inset:0;z-index:100020;background:rgba(0,0,0,.74);padding:24px;overflow:auto;';
    modal.innerHTML='<div style="max-width:1180px;margin:0 auto;background:#120d09;color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:24px;padding:18px 18px 26px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><div><div style="font:700 20px system-ui">White-glove client transparency center</div><div style="font:12px system-ui;opacity:.72">Builds client-facing transparency packets and member statements from the canonical white-glove chain.</div></div><button id="wg-v57-close" style="border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#fff;padding:8px 12px;border-radius:12px;cursor:pointer">Close</button></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px"><section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><button id="wg-v57-build-packet">Build client packet</button><button id="wg-v57-export-packet-html">Export packet HTML</button><button id="wg-v57-export-packet-json">Export packet JSON</button></div><pre id="wg-v57-packet" style="white-space:pre-wrap;background:rgba(255,255,255,.04);padding:12px;border-radius:14px;max-height:360px;overflow:auto"></pre></section><section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><button id="wg-v57-build-statement">Build member statement</button><button id="wg-v57-export-statement-html">Export statement HTML</button><button id="wg-v57-export-statement-json">Export statement JSON</button></div><pre id="wg-v57-statement" style="white-space:pre-wrap;background:rgba(255,255,255,.04);padding:12px;border-radius:14px;max-height:360px;overflow:auto"></pre></section></div><div style="margin-top:16px;border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><h3 style="margin:0 0 10px">Purpose</h3><div style="font:13px system-ui;line-height:1.6;opacity:.88">This pass makes the premium service chain easier to explain outwardly. Operators can produce a clear packet for a rider/client and a separate member statement without digging through raw internals.</div><div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><button id="wg-v57-run-guide">Run v57 guide</button><button id="wg-v57-open-v56">Open v56</button></div></div></div>';
    document.body.appendChild(launcher); document.body.appendChild(modal);
    const packetPre = modal.querySelector('#wg-v57-packet'); const statementPre = modal.querySelector('#wg-v57-statement');
    const refresh = ()=> { render(packetPre, latest('packets')); render(statementPre, latest('statements')); };
    launcher.onclick = ()=> { modal.style.display='block'; refresh(); };
    modal.querySelector('#wg-v57-close').onclick = ()=> { modal.style.display='none'; };
    modal.querySelector('#wg-v57-build-packet').onclick = ()=> { const row = buildClientTransparencyPacket(); if(!row) return toast('No white-glove booking found.'); toast('Client transparency packet saved.'); render(packetPre, row); };
    modal.querySelector('#wg-v57-export-packet-html').onclick = ()=> { const row = latest('packets'); if(!row) return toast('Build a client packet first.'); downloadText(packetHtml(row), 'whiteglove-client-packet-v57.html', 'text/html'); };
    modal.querySelector('#wg-v57-export-packet-json').onclick = ()=> { const row = latest('packets'); if(!row) return toast('Build a client packet first.'); downloadText(JSON.stringify(row, null, 2), 'whiteglove-client-packet-v57.json', 'application/json'); };
    modal.querySelector('#wg-v57-build-statement').onclick = ()=> { const row = buildMemberStatement(); if(!row) return toast('No white-glove membership found.'); toast('Member statement saved.'); render(statementPre, row); };
    modal.querySelector('#wg-v57-export-statement-html').onclick = ()=> { const row = latest('statements'); if(!row) return toast('Build a member statement first.'); downloadText(statementHtml(row), 'whiteglove-member-statement-v57.html', 'text/html'); };
    modal.querySelector('#wg-v57-export-statement-json').onclick = ()=> { const row = latest('statements'); if(!row) return toast('Build a member statement first.'); downloadText(JSON.stringify(row, null, 2), 'whiteglove-member-statement-v57.json', 'application/json'); };
    modal.querySelector('#wg-v57-run-guide').onclick = ()=> { if(window.startWhiteGloveTourV57) window.startWhiteGloveTourV57(); };
    modal.querySelector('#wg-v57-open-v56').onclick = ()=> { if(window.openWhiteGloveV56Center) window.openWhiteGloveV56Center(); };
    const host = document.querySelector('#app') || document.body;
    if(!document.getElementById('wgClientPacketCard57')){
      const card = document.createElement('div');
      card.id='wgClientPacketCard57'; card.className='card';
      card.innerHTML='<h2 style="margin:0 0 10px">Client transparency + member statement</h2><div style="font-size:13px;line-height:1.6">Use <strong>WG Client Pack</strong> to build outward-facing transparency packets and member statements from the canonical white-glove booking/membership chain.</div>';
      host.appendChild(card);
    }
  }
  window.buildWhiteGloveClientTransparencyPacketV57 = buildClientTransparencyPacket;
  window.buildWhiteGloveMemberStatementV57 = buildMemberStatement;
  window.openWhiteGloveV57Center = function(){ ensureUI(); const btn = document.getElementById('wg-v57-launcher'); if(btn) btn.click(); };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureUI); else ensureUI();
})();
