(function(){
  if(window.__ROUTEX_HOUSECIRCLE_V60__) return;
  window.__ROUTEX_HOUSECIRCLE_V60__ = true;

  const KEY_OPERATORS = 'skye_routex_platform_house_circle_operators_v60';
  const KEY_SESSION = 'skye_routex_platform_house_circle_session_v60';
  const KEY_AUDIT = 'skye_routex_platform_house_circle_audit_v60';
  const KEY_PACKETS = 'skye_routex_platform_house_circle_join_packets_v60';
  const KEY_CHECKINS = 'skye_routex_platform_house_circle_checkins_v60';
  const KEY_POS = 'skye_routex_platform_house_circle_pos_v60';
  const KEY_OUTBOX = 'skye_routex_platform_house_circle_full_outbox_v60';
  const KEY_POS_OUTBOX = 'skye_routex_platform_house_circle_pos_outbox_v60';
  const KEY_PACKET_OUTBOX = 'skye_routex_platform_house_circle_packet_outbox_v60';
  const KEY_AUDIT_OUTBOX = 'skye_routex_platform_house_circle_audit_outbox_v60';
  const FOUNDER_EMAIL = 'SkyesOverLondonLC@solenterprises.org';
  const LIMIT_AUDIT = 400;

  const clean = window.cleanStr || function(v){ return String(v == null ? '' : v).trim(); };
  const esc = window.escapeHTML || function(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(m){ return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[m]; }); };
  const uidFn = typeof uid === 'function' ? uid : function(){ return 'hc60-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8); };
  const nowFn = typeof nowISO === 'function' ? nowISO : function(){ return new Date().toISOString(); };
  const dayFn = typeof dayISO === 'function' ? dayISO : function(){ return new Date().toISOString().slice(0,10); };
  const fmtFn = typeof fmt === 'function' ? fmt : function(v){ try{ return new Date(v).toLocaleString(); }catch(_){ return clean(v); } };
  const moneyFn = typeof fmtMoney === 'function' ? fmtMoney : function(v){ return '$' + Number(v || 0).toFixed(2); };
  const toastFn = typeof toast === 'function' ? toast : function(){};
  const downloadTextFn = typeof downloadText === 'function' ? downloadText : function(text, filename, mime){
    const blob = new Blob([text], { type: mime || 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename || 'download.txt';
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){ try{ URL.revokeObjectURL(a.href); }catch(_){} if(a.remove) a.remove(); }, 0);
  };
  const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame.bind(window) : function(cb){ return setTimeout(cb, 0); };

  const ROLE_DEFS = {
    founder_admin: {
      label: 'Founder Admin',
      permissions: ['manage_operators','manage_hospitality','manage_pos','manage_qr','manage_bridge','export_data','view_audit']
    },
    hospitality_manager: {
      label: 'Hospitality Manager',
      permissions: ['manage_hospitality','manage_pos','manage_qr','manage_bridge','export_data','view_audit']
    },
    dispatcher: {
      label: 'Dispatcher',
      permissions: ['manage_bridge','manage_hospitality','view_audit']
    },
    venue_operator: {
      label: 'Venue Operator',
      permissions: ['manage_pos','manage_qr']
    },
    auditor: {
      label: 'Auditor',
      permissions: ['export_data','view_audit']
    }
  };

  function base(){ return window.RoutexPlatformHouseCircle || null; }
  function clone(v){ return JSON.parse(JSON.stringify(v)); }
  function listify(v){ return Array.isArray(v) ? v.filter(Boolean) : []; }
  function readJSON(key, fallback){ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } }
  function writeJSON(key, value){ localStorage.setItem(key, JSON.stringify(value)); return value; }
  function num(v){ const n = Number(v || 0); return Number.isFinite(n) ? n : 0; }
  function compact(v){ return clean(v).replace(/\s+/g, ' ').trim(); }
  function normalizeEmail(v){ return clean(v).toLowerCase(); }
  function normalizePhone(v){ return clean(v).replace(/[^\d+]/g, ''); }
  function packetCode(){ return 'PHC-' + Math.random().toString(36).slice(2,6).toUpperCase() + '-' + Math.random().toString(36).slice(2,6).toUpperCase(); }

  function founderSeed(){
    return {
      id: 'operator-founder-admin',
      name: 'Skyes Over London',
      email: FOUNDER_EMAIL,
      role: 'founder_admin',
      active: true,
      pinned: true,
      notes: 'Default founder operator seeded by the integral stack.',
      createdAt: nowFn(),
      updatedAt: nowFn()
    };
  }

  function normalizeOperator(item){
    const value = item && typeof item === 'object' ? item : {};
    const role = clean(value.role) || 'venue_operator';
    return {
      id: clean(value.id) || uidFn(),
      name: compact(value.name) || 'Unnamed operator',
      email: normalizeEmail(value.email),
      role: ROLE_DEFS[role] ? role : 'venue_operator',
      active: value.active !== false,
      pinned: !!value.pinned,
      notes: compact(value.notes),
      createdAt: clean(value.createdAt) || nowFn(),
      updatedAt: clean(value.updatedAt) || nowFn()
    };
  }

  function readOperators(){
    const rows = listify(readJSON(KEY_OPERATORS, [])).map(normalizeOperator);
    if(!rows.length){
      const seeded = [founderSeed()];
      writeJSON(KEY_OPERATORS, seeded);
      return seeded;
    }
    if(!rows.find(function(item){ return item.role === 'founder_admin'; })){
      rows.unshift(founderSeed());
      writeJSON(KEY_OPERATORS, rows);
    }
    return rows;
  }
  function saveOperators(rows){ return writeJSON(KEY_OPERATORS, listify(rows).map(normalizeOperator)); }

  function normalizeSession(session){
    const value = session && typeof session === 'object' ? session : {};
    return {
      operatorId: clean(value.operatorId) || 'operator-founder-admin',
      startedAt: clean(value.startedAt) || nowFn(),
      updatedAt: nowFn(),
      mode: clean(value.mode) || 'active'
    };
  }
  function readSession(){
    const operators = readOperators();
    const session = normalizeSession(readJSON(KEY_SESSION, {}));
    const operator = operators.find(function(item){ return item.id === session.operatorId && item.active !== false; }) || operators[0];
    if(!operator) return normalizeSession({ operatorId: 'operator-founder-admin' });
    if(operator.id !== session.operatorId){
      const repaired = normalizeSession({ operatorId: operator.id, startedAt: session.startedAt || nowFn() });
      writeJSON(KEY_SESSION, repaired);
      return repaired;
    }
    return session;
  }
  function saveSession(session){ return writeJSON(KEY_SESSION, normalizeSession(session)); }
  function currentOperator(){
    const operators = readOperators();
    const session = readSession();
    return operators.find(function(item){ return item.id === session.operatorId; }) || operators[0] || founderSeed();
  }
  function permissionsFor(role){ return clone((ROLE_DEFS[role] && ROLE_DEFS[role].permissions) || []); }
  function can(permission){
    if(!permission) return true;
    const op = currentOperator();
    return permissionsFor(op.role).includes(permission);
  }
  function requirePermission(permission){
    if(!can(permission)) throw new Error('Current operator cannot perform ' + permission + '.');
  }

  function normalizeAudit(item){
    const value = item && typeof item === 'object' ? item : {};
    return {
      id: clean(value.id) || uidFn(),
      at: clean(value.at) || nowFn(),
      operatorId: clean(value.operatorId),
      operatorName: compact(value.operatorName),
      action: compact(value.action) || 'platform-action',
      detail: compact(value.detail),
      tone: compact(value.tone),
      meta: value.meta && typeof value.meta === 'object' ? clone(value.meta) : {}
    };
  }
  function readAudit(){ return listify(readJSON(KEY_AUDIT, [])).map(normalizeAudit).slice(0, LIMIT_AUDIT); }
  function saveAudit(rows){ return writeJSON(KEY_AUDIT, listify(rows).map(normalizeAudit).slice(0, LIMIT_AUDIT)); }
  function appendAudit(action, detail, tone, meta){
    const op = currentOperator();
    const row = normalizeAudit({ action: action, detail: detail, tone: tone, meta: meta, operatorId: op.id, operatorName: op.name, at: nowFn() });
    const next = [row].concat(readAudit().filter(function(item){ return item.id !== row.id; })).slice(0, LIMIT_AUDIT);
    saveAudit(next);
    return row;
  }
  function pushOutbox(key, payload){
    const list = listify(readJSON(key, []));
    list.unshift({ id: uidFn(), at: nowFn(), payload: clone(payload || {}) });
    return writeJSON(key, list.slice(0, 120));
  }

  function readPackets(){ return listify(readJSON(KEY_PACKETS, [])); }
  function savePackets(rows){ return writeJSON(KEY_PACKETS, listify(rows)); }
  function readCheckins(){ return listify(readJSON(KEY_CHECKINS, [])); }
  function saveCheckins(rows){ return writeJSON(KEY_CHECKINS, listify(rows)); }
  function readPosTickets(){ return listify(readJSON(KEY_POS, [])); }
  function savePosTickets(rows){ return writeJSON(KEY_POS, listify(rows)); }

  function state(){
    const api = base();
    if(!api || typeof api.readState !== 'function') throw new Error('Base Platform House API is unavailable.');
    return api.readState();
  }
  function saveState(next){
    const api = base();
    if(!api || typeof api.saveState !== 'function') throw new Error('Base Platform House API is unavailable.');
    return api.saveState(next);
  }
  function withHospitality(mutator){
    const st = state();
    const out = mutator(st) || st;
    return saveState(out);
  }

  function findLocation(st, id){ return listify(st.locations).find(function(item){ return clean(item.id) === clean(id); }) || null; }
  function findGuest(st, id){ return listify(st.guests).find(function(item){ return clean(item.id) === clean(id); }) || null; }
  function findGuestByIdentity(st, payload, locationId){
    const email = normalizeEmail(payload && payload.email);
    const phone = normalizePhone(payload && payload.phone);
    const name = compact(payload && payload.name).toLowerCase();
    return listify(st.guests).find(function(item){
      if(clean(locationId) && clean(item.locationId) !== clean(locationId)) return false;
      if(email && normalizeEmail(item.email) === email) return true;
      if(phone && normalizePhone(item.phone) === phone) return true;
      return !!name && compact(item.name).toLowerCase() === name;
    }) || null;
  }
  function appendTimeline(st, row){
    st.timeline = [{
      id: clean(row.id) || uidFn(),
      at: clean(row.at) || nowFn(),
      kind: compact(row.kind) || 'note',
      label: compact(row.label) || 'Timeline event',
      detail: compact(row.detail),
      entityType: compact(row.entityType),
      entityId: clean(row.entityId),
      locationId: clean(row.locationId),
      guestId: clean(row.guestId),
      routeId: clean(row.routeId),
      stopId: clean(row.stopId),
      tone: compact(row.tone),
      createdAt: clean(row.createdAt) || nowFn()
    }].concat(listify(st.timeline)).slice(0, 400);
  }
  function recalcLocationStats(st, locationId){
    const location = findLocation(st, locationId);
    if(!location) return null;
    const guests = listify(st.guests).filter(function(item){ return clean(item.locationId) === clean(locationId); });
    const memberships = listify(st.memberships).filter(function(item){ return clean(item.locationId) === clean(locationId) && compact(item.status).toLowerCase() === 'active'; });
    location.guestCount = guests.length;
    location.memberCount = memberships.length;
    location.totalSpend = guests.reduce(function(sum, item){ return sum + num(item.totalSpend); }, 0);
    location.lastGuestAt = guests.map(function(item){ return clean(item.lastVisitAt); }).filter(Boolean).sort().pop() || location.lastGuestAt || '';
    location.updatedAt = nowFn();
    return location;
  }

  function createOperator(payload){
    requirePermission('manage_operators');
    const rows = readOperators();
    const email = normalizeEmail(payload && payload.email);
    if(email && rows.find(function(item){ return normalizeEmail(item.email) === email; })) throw new Error('Operator email already exists.');
    const op = normalizeOperator({
      id: uidFn(),
      name: payload && payload.name,
      email: email,
      role: payload && payload.role,
      notes: payload && payload.notes,
      active: true,
      createdAt: nowFn(),
      updatedAt: nowFn()
    });
    rows.unshift(op);
    saveOperators(rows);
    appendAudit('operator-created', op.name + ' • ' + ROLE_DEFS[op.role].label, 'good', { operatorId: op.id, role: op.role });
    toastFn('Operator added.', 'good');
    return op;
  }

  function switchOperator(operatorId){
    const rows = readOperators();
    const op = rows.find(function(item){ return item.id === clean(operatorId) && item.active !== false; });
    if(!op) throw new Error('Operator not found.');
    saveSession({ operatorId: op.id, startedAt: nowFn(), updatedAt: nowFn(), mode: 'active' });
    appendAudit('operator-switched', 'Active operator is now ' + op.name, 'warn', { operatorId: op.id, role: op.role });
    toastFn('Operator switched.', 'good');
    return op;
  }

  function deepLinkForPacket(code){
    const origin = (window.location && window.location.origin) ? window.location.origin : '';
    const path = (window.location && window.location.pathname) ? window.location.pathname : '';
    return origin + path + '#platform-house-checkin/' + encodeURIComponent(code);
  }

  function packetSvg(packet, location){
    const title = esc((location && location.name) || 'Platform House location');
    const code = esc(packet.code || '—');
    const offer = esc(packet.offer || 'Member check-in');
    const url = esc(packet.deepLink || '');
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#120024"/>
      <stop offset="55%" stop-color="#220847"/>
      <stop offset="100%" stop-color="#05000a"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1080" rx="48" fill="url(#bg)"/>
  <rect x="70" y="70" width="940" height="940" rx="40" fill="rgba(255,255,255,.03)" stroke="rgba(255,255,255,.12)"/>
  <text x="100" y="170" fill="#ffd46b" font-size="40" font-family="Arial, sans-serif" font-weight="700">Platform House Circle</text>
  <text x="100" y="240" fill="#ffffff" font-size="64" font-family="Arial, sans-serif" font-weight="800">${title}</text>
  <text x="100" y="300" fill="#bda8ff" font-size="28" font-family="Arial, sans-serif">${offer}</text>
  <rect x="100" y="360" width="520" height="520" rx="28" fill="#ffffff"/>
  <g fill="#120024">
    <rect x="150" y="410" width="120" height="120" rx="12"/>
    <rect x="300" y="410" width="70" height="70" rx="8"/>
    <rect x="400" y="410" width="170" height="50" rx="8"/>
    <rect x="400" y="490" width="120" height="120" rx="8"/>
    <rect x="150" y="560" width="220" height="70" rx="8"/>
    <rect x="150" y="660" width="90" height="90" rx="8"/>
    <rect x="270" y="660" width="100" height="150" rx="8"/>
    <rect x="400" y="650" width="130" height="60" rx="8"/>
    <rect x="400" y="740" width="70" height="70" rx="8"/>
    <rect x="490" y="740" width="80" height="80" rx="8"/>
    <rect x="640" y="360" width="310" height="120" rx="24" fill="#1d0d34"/>
  </g>
  <text x="650" y="430" fill="#ffd46b" font-size="28" font-family="Arial, sans-serif">JOIN CODE</text>
  <text x="650" y="465" fill="#ffffff" font-size="44" font-family="Courier New, monospace" font-weight="700">${code}</text>
  <text x="650" y="570" fill="#ffffff" font-size="26" font-family="Arial, sans-serif">Use the code in the Platform House check-in lane</text>
  <text x="650" y="610" fill="#8ee3ff" font-size="20" font-family="Courier New, monospace">${url}</text>
  <text x="100" y="950" fill="#c9bbff" font-size="24" font-family="Arial, sans-serif">Skyes Over London • Routex integral hospitality lane</text>
</svg>`;
  }

  function createJoinPacket(payload){
    requirePermission('manage_qr');
    const st = state();
    const location = findLocation(st, payload && payload.locationId);
    if(!location) throw new Error('Choose a valid location.');
    const packet = {
      id: uidFn(),
      code: packetCode(),
      locationId: location.id,
      locationName: location.name,
      tier: compact(payload && payload.tier) || 'Guest',
      offer: compact(payload && payload.offer) || 'Member check-in',
      status: 'active',
      createdAt: nowFn(),
      updatedAt: nowFn(),
      expiresAt: clean(payload && payload.expiresAt),
      createdBy: currentOperator().id,
      scanCount: 0,
      deepLink: deepLinkForPacket(packetCode())
    };
    packet.deepLink = deepLinkForPacket(packet.code);
    const rows = [packet].concat(readPackets());
    savePackets(rows);
    appendAudit('join-packet-created', location.name + ' • ' + packet.code, 'good', { packetId: packet.id, locationId: location.id, code: packet.code });
    pushOutbox(KEY_PACKET_OUTBOX, packet);
    withHospitality(function(next){
      appendTimeline(next, { kind:'join-packet', label:'Join packet created', detail:[location.name, packet.code, packet.offer].filter(Boolean).join(' • '), entityType:'location', entityId:location.id, locationId:location.id, tone:'good', at:packet.createdAt });
      return next;
    });
    toastFn('Join packet created.', 'good');
    return packet;
  }

  function redeemJoinPacket(codeOrId, guestPayload){
    requirePermission('manage_qr');
    const packets = readPackets();
    const packet = packets.find(function(item){ return clean(item.id) === clean(codeOrId) || clean(item.code).toUpperCase() === clean(codeOrId).toUpperCase(); });
    if(!packet) throw new Error('Packet not found.');
    if(compact(packet.status).toLowerCase() !== 'active') throw new Error('Packet is not active.');
    if(packet.expiresAt && String(packet.expiresAt) < nowFn()) throw new Error('Packet has expired.');
    const checkin = { id: uidFn(), packetId: packet.id, code: packet.code, locationId: packet.locationId, at: nowFn(), guestName: compact(guestPayload && guestPayload.name), guestEmail: normalizeEmail(guestPayload && guestPayload.email), guestPhone: normalizePhone(guestPayload && guestPayload.phone), note: compact(guestPayload && guestPayload.note), tier: packet.tier, offer: packet.offer };
    const nextState = withHospitality(function(st){
      let guest = findGuestByIdentity(st, guestPayload || {}, packet.locationId);
      if(!guest){
        guest = {
          id: uidFn(),
          locationId: packet.locationId,
          sourceAccountId: '',
          name: checkin.guestName || 'Platform House guest',
          email: checkin.guestEmail,
          phone: checkin.guestPhone,
          tier: packet.tier || 'Guest',
          points: 0,
          visitCount: 0,
          totalSpend: 0,
          lastVisitAt: '',
          tags: ['qr-join'],
          notes: compact(guestPayload && guestPayload.note),
          createdAt: nowFn(),
          updatedAt: nowFn()
        };
        st.guests.unshift(guest);
      }
      guest.visitCount = Math.max(0, num(guest.visitCount)) + 1;
      guest.lastVisitAt = checkin.at;
      guest.tier = compact(guest.tier) || compact(packet.tier) || 'Guest';
      guest.tags = Array.from(new Set(listify(guest.tags).concat(['qr-join', compact(packet.tier).toLowerCase()]))).filter(Boolean).slice(0, 12);
      guest.updatedAt = nowFn();
      let membership = listify(st.memberships).find(function(item){ return clean(item.guestId) === clean(guest.id) && clean(item.locationId) === clean(packet.locationId); });
      if(!membership){
        membership = { id: uidFn(), guestId: guest.id, locationId: packet.locationId, tier: guest.tier, status: 'active', joinedAt: checkin.at, renewalAt: '', notes: 'Created from join packet ' + packet.code, createdAt: nowFn(), updatedAt: nowFn() };
        st.memberships.unshift(membership);
      } else {
        membership.tier = guest.tier;
        membership.status = 'active';
        membership.updatedAt = nowFn();
      }
      recalcLocationStats(st, packet.locationId);
      appendTimeline(st, { kind:'member-checkin', label:'Member check-in redeemed', detail:[guest.name, packet.code, packet.offer].filter(Boolean).join(' • '), entityType:'guest', entityId:guest.id, locationId:packet.locationId, guestId:guest.id, tone:'good', at:checkin.at });
      checkin.guestId = guest.id;
      return st;
    });
    const checkins = [checkin].concat(readCheckins());
    saveCheckins(checkins);
    packet.scanCount = Math.max(0, num(packet.scanCount)) + 1;
    packet.updatedAt = nowFn();
    savePackets(packets);
    appendAudit('join-packet-redeemed', packet.code + ' • ' + (checkin.guestName || checkin.guestEmail || 'guest'), 'good', { packetId: packet.id, locationId: packet.locationId, guestId: checkin.guestId });
    pushOutbox(KEY_PACKET_OUTBOX, { type:'redeemed', checkin: checkin });
    toastFn('Check-in redeemed.', 'good');
    return { packet: packet, checkin: checkin, state: nextState };
  }

  function recordPosTicket(payload){
    requirePermission('manage_pos');
    const amount = Number(payload && payload.amount);
    if(!Number.isFinite(amount) || amount <= 0) throw new Error('Enter a valid POS amount.');
    const st = state();
    const location = findLocation(st, payload && payload.locationId);
    if(!location) throw new Error('Choose a valid location.');
    const ticket = {
      id: uidFn(),
      locationId: location.id,
      locationName: location.name,
      guestName: compact(payload && payload.guestName),
      guestEmail: normalizeEmail(payload && payload.guestEmail),
      guestPhone: normalizePhone(payload && payload.guestPhone),
      amount: Number(amount.toFixed(2)),
      items: Math.max(1, Math.round(num(payload && payload.items) || 1)),
      channel: compact(payload && payload.channel) || 'manual-pos',
      note: compact(payload && payload.note),
      at: clean(payload && payload.at) || nowFn(),
      operatorId: currentOperator().id
    };
    const nextState = withHospitality(function(next){
      let guest = findGuestByIdentity(next, { name: ticket.guestName, email: ticket.guestEmail, phone: ticket.guestPhone }, ticket.locationId);
      if(!guest){
        guest = {
          id: uidFn(),
          locationId: ticket.locationId,
          sourceAccountId: '',
          name: ticket.guestName || 'POS guest',
          email: ticket.guestEmail,
          phone: ticket.guestPhone,
          tier: 'Guest',
          points: 0,
          visitCount: 0,
          totalSpend: 0,
          lastVisitAt: '',
          tags: ['pos'],
          notes: ticket.note,
          createdAt: nowFn(),
          updatedAt: nowFn()
        };
        next.guests.unshift(guest);
      }
      guest.totalSpend = Number((num(guest.totalSpend) + ticket.amount).toFixed(2));
      guest.visitCount = Math.max(0, num(guest.visitCount)) + 1;
      guest.lastVisitAt = ticket.at;
      guest.updatedAt = nowFn();
      guest.tags = Array.from(new Set(listify(guest.tags).concat(['pos', ticket.channel]))).filter(Boolean).slice(0,12);
      let membership = listify(next.memberships).find(function(item){ return clean(item.guestId) === clean(guest.id) && clean(item.locationId) === clean(ticket.locationId); });
      if(!membership){
        membership = { id: uidFn(), guestId: guest.id, locationId: ticket.locationId, tier: guest.tier, status:'active', joinedAt: ticket.at, renewalAt:'', notes:'Created from POS sale.', createdAt:nowFn(), updatedAt:nowFn() };
        next.memberships.unshift(membership);
      }
      recalcLocationStats(next, ticket.locationId);
      appendTimeline(next, { kind:'pos-ticket', label:'POS sale logged', detail:[location.name, moneyFn(ticket.amount), ticket.channel].join(' • '), entityType:'location', entityId:location.id, locationId:location.id, guestId:guest.id, tone:'good', at:ticket.at });
      ticket.guestId = guest.id;
      return next;
    });
    savePosTickets([ticket].concat(readPosTickets()));
    appendAudit('pos-ticket-recorded', location.name + ' • ' + moneyFn(ticket.amount), 'good', { ticketId: ticket.id, locationId: location.id, guestId: ticket.guestId, amount: ticket.amount });
    pushOutbox(KEY_POS_OUTBOX, ticket);
    toastFn('POS ticket logged.', 'good');
    return { ticket: ticket, state: nextState };
  }

  function importPosRows(rows){
    requirePermission('manage_pos');
    const items = listify(rows);
    if(!items.length) throw new Error('No POS rows supplied.');
    const created = [];
    items.forEach(function(item){
      try{
        const out = recordPosTicket(item);
        created.push(out.ticket);
      }catch(_){ }
    });
    appendAudit('pos-batch-import', 'Imported ' + created.length + ' POS row(s).', created.length ? 'good' : 'warn', { count: created.length });
    return created;
  }

  function buildExtendedStats(){
    const st = state();
    const packets = readPackets();
    const checkins = readCheckins();
    const pos = readPosTickets();
    const operators = readOperators();
    const audit = readAudit();
    return {
      locations: listify(st.locations).length,
      guests: listify(st.guests).length,
      operators: operators.length,
      packets: packets.length,
      activePackets: packets.filter(function(item){ return compact(item.status).toLowerCase() === 'active'; }).length,
      checkins: checkins.length,
      posTickets: pos.length,
      posRevenue: Number(pos.reduce(function(sum, item){ return sum + num(item.amount); }, 0).toFixed(2)),
      audit: audit.length,
      currentOperator: currentOperator(),
      permissions: permissionsFor(currentOperator().role)
    };
  }

  function exportAuditBundle(){
    requirePermission('view_audit');
    const payload = { type:'skye-routex-platform-house-circle-audit-v60', exportedAt: nowFn(), audit: readAudit(), operators: readOperators(), session: readSession() };
    pushOutbox(KEY_AUDIT_OUTBOX, payload);
    downloadTextFn(JSON.stringify(payload, null, 2), 'skye_routex_platform_house_circle_audit_v60_' + dayFn() + '.json', 'application/json');
    appendAudit('audit-exported', 'Audit bundle exported.', 'good', { count: payload.audit.length });
    return payload;
  }

  function exportFullBundle(){
    requirePermission('export_data');
    const payload = {
      type: 'skye-routex-platform-house-circle-v60',
      exportedAt: nowFn(),
      hospitality: state(),
      operators: readOperators(),
      session: readSession(),
      packets: readPackets(),
      checkins: readCheckins(),
      posTickets: readPosTickets(),
      audit: readAudit(),
      stats: buildExtendedStats()
    };
    pushOutbox(KEY_OUTBOX, payload);
    downloadTextFn(JSON.stringify(payload, null, 2), 'skye_routex_platform_house_circle_v60_' + dayFn() + '.json', 'application/json');
    appendAudit('platform-exported', 'Full Platform House v60 bundle exported.', 'good', { locations: payload.hospitality.locations.length, guests: payload.hospitality.guests.length });
    return payload;
  }

  function importFullBundle(bundle){
    requirePermission('export_data');
    const data = bundle && typeof bundle === 'object' ? bundle : {};
    if(clean(data.type) !== 'skye-routex-platform-house-circle-v60') throw new Error('Bundle not recognized.');
    saveState(data.hospitality || {});
    saveOperators(data.operators || [founderSeed()]);
    saveSession(data.session || {});
    savePackets(data.packets || []);
    saveCheckins(data.checkins || []);
    savePosTickets(data.posTickets || []);
    saveAudit(data.audit || []);
    appendAudit('platform-imported', 'Full Platform House v60 bundle imported.', 'good', { locations: listify((data.hospitality || {}).locations).length, guests: listify((data.hospitality || {}).guests).length });
    return buildExtendedStats();
  }

  function labelForRole(role){ return (ROLE_DEFS[role] && ROLE_DEFS[role].label) || role; }

  function openOperatorModal(){
    if(typeof openModal !== 'function') return;
    const operators = readOperators();
    const current = currentOperator();
    openModal('Platform House operators', `
      <div class="hint">Switch the active operator or create a new one. Founder admin can manage the full hospitality lane. This is local-first role control baked into the Routex shell.</div>
      <div class="sep"></div>
      <div class="list">${operators.map(function(item){ return `<div class="item"><div class="meta"><div class="name">${esc(item.name)} <span class="badge">${esc(labelForRole(item.role))}</span>${item.id === current.id ? ' <span class="badge good">Active</span>' : ''}</div><div class="sub">${esc(item.email || 'No email')} • ${item.active === false ? 'Inactive' : 'Active'}</div></div><div class="actions">${item.id !== current.id ? `<button class="btn small" data-hc60-switch="${esc(item.id)}">Switch</button>` : ''}</div></div>`; }).join('')}</div>
      <div class="sep"></div>
      <div class="fieldrow"><div class="field"><label>Name</label><input id="hc60_operator_name" placeholder="Operator name"/></div><div class="field"><label>Email</label><input id="hc60_operator_email" placeholder="Operator email"/></div></div>
      <div class="fieldrow"><div class="field"><label>Role</label><select id="hc60_operator_role">${Object.keys(ROLE_DEFS).map(function(role){ return `<option value="${esc(role)}">${esc(labelForRole(role))}</option>`; }).join('')}</select></div><div class="field"><label>Notes</label><input id="hc60_operator_notes" placeholder="Optional notes"/></div></div>
    `, `<button class="btn" onclick="document.getElementById('modalClose').click()">Close</button><button class="btn primary" id="hc60_create_operator_btn">Create operator</button>`);
    Array.from(document.querySelectorAll('[data-hc60-switch]')).forEach(function(btn){ btn.onclick = function(){ try{ switchOperator(btn.getAttribute('data-hc60-switch')); closeModal(); if(typeof render === 'function') render(); }catch(err){ toastFn(clean(err && err.message) || 'Switch failed.', 'bad'); } }; });
    const createBtn = document.getElementById('hc60_create_operator_btn');
    if(createBtn) createBtn.onclick = function(){
      try{
        createOperator({ name: document.getElementById('hc60_operator_name').value, email: document.getElementById('hc60_operator_email').value, role: document.getElementById('hc60_operator_role').value, notes: document.getElementById('hc60_operator_notes').value });
        closeModal(); if(typeof render === 'function') render();
      }catch(err){ toastFn(clean(err && err.message) || 'Operator creation failed.', 'bad'); }
    };
  }

  function locationOptions(selectedId){
    return listify(state().locations).map(function(loc){ return `<option value="${esc(loc.id)}" ${clean(loc.id)===clean(selectedId)?'selected':''}>${esc(loc.name)}${loc.serviceArea ? ' • ' + esc(loc.serviceArea) : ''}</option>`; }).join('');
  }

  function openPacketModal(defaultCode){
    if(typeof openModal !== 'function') return;
    openModal('Platform House join packets', `
      <div class="hint">Generate a shareable join packet or redeem an existing packet inside the Routex shell.</div>
      <div class="sep"></div>
      <div class="fieldrow"><div class="field"><label>Location</label><select id="hc60_packet_location">${locationOptions('')}</select></div><div class="field"><label>Tier</label><input id="hc60_packet_tier" value="Guest"/></div></div>
      <div class="fieldrow"><div class="field"><label>Offer</label><input id="hc60_packet_offer" value="Member check-in"/></div><div class="field"><label>Expires at</label><input id="hc60_packet_expire" type="datetime-local"/></div></div>
      <div class="sep"></div>
      <div class="fieldrow"><div class="field"><label>Redeem code</label><input id="hc60_redeem_code" value="${esc(defaultCode || '')}" placeholder="PHC-XXXX-XXXX"/></div><div class="field"><label>Guest name</label><input id="hc60_redeem_name" placeholder="Guest name"/></div></div>
      <div class="fieldrow"><div class="field"><label>Guest email</label><input id="hc60_redeem_email" placeholder="Guest email"/></div><div class="field"><label>Guest phone</label><input id="hc60_redeem_phone" placeholder="Guest phone"/></div></div>
      <div class="fieldrow"><div class="field full"><label>Check-in note</label><input id="hc60_redeem_note" placeholder="Optional note"/></div></div>
    `, `<button class="btn" id="hc60_packet_make_btn">Create packet</button><button class="btn" id="hc60_packet_redeem_btn">Redeem packet</button><button class="btn" onclick="document.getElementById('modalClose').click()">Close</button>`);
    const makeBtn = document.getElementById('hc60_packet_make_btn');
    const redeemBtn = document.getElementById('hc60_packet_redeem_btn');
    if(makeBtn) makeBtn.onclick = function(){
      try{
        const packet = createJoinPacket({ locationId: document.getElementById('hc60_packet_location').value, tier: document.getElementById('hc60_packet_tier').value, offer: document.getElementById('hc60_packet_offer').value, expiresAt: document.getElementById('hc60_packet_expire').value ? new Date(document.getElementById('hc60_packet_expire').value).toISOString() : '' });
        closeModal(); exportPacketSvg(packet.id); if(typeof render === 'function') render();
      }catch(err){ toastFn(clean(err && err.message) || 'Packet creation failed.', 'bad'); }
    };
    if(redeemBtn) redeemBtn.onclick = function(){
      try{
        redeemJoinPacket(document.getElementById('hc60_redeem_code').value, { name: document.getElementById('hc60_redeem_name').value, email: document.getElementById('hc60_redeem_email').value, phone: document.getElementById('hc60_redeem_phone').value, note: document.getElementById('hc60_redeem_note').value });
        closeModal(); if(typeof render === 'function') render();
      }catch(err){ toastFn(clean(err && err.message) || 'Check-in failed.', 'bad'); }
    };
  }

  function openPosModal(){
    if(typeof openModal !== 'function') return;
    openModal('Platform House POS lane', `
      <div class="hint">Log a POS ticket directly into the integrated hospitality lane or import a JSON array of POS rows.</div>
      <div class="sep"></div>
      <div class="fieldrow"><div class="field"><label>Location</label><select id="hc60_pos_location">${locationOptions('')}</select></div><div class="field"><label>Amount</label><input id="hc60_pos_amount" type="number" min="0" step="0.01" placeholder="0.00"/></div></div>
      <div class="fieldrow"><div class="field"><label>Guest name</label><input id="hc60_pos_guest_name" placeholder="Guest name"/></div><div class="field"><label>Guest email</label><input id="hc60_pos_guest_email" placeholder="Guest email"/></div></div>
      <div class="fieldrow"><div class="field"><label>Guest phone</label><input id="hc60_pos_guest_phone" placeholder="Guest phone"/></div><div class="field"><label>Channel</label><input id="hc60_pos_channel" value="manual-pos"/></div></div>
      <div class="fieldrow"><div class="field"><label>Items</label><input id="hc60_pos_items" type="number" min="1" step="1" value="1"/></div><div class="field"><label>At</label><input id="hc60_pos_at" type="datetime-local"/></div></div>
      <div class="fieldrow"><div class="field full"><label>Note</label><input id="hc60_pos_note" placeholder="Optional note"/></div></div>
      <div class="sep"></div>
      <div class="fieldrow"><div class="field full"><label>Batch import JSON</label><textarea id="hc60_pos_batch" rows="7" placeholder='[{"locationId":"...","amount":42.5,"guestName":"Name"}]'></textarea></div></div>
    `, `<button class="btn" id="hc60_pos_save_btn">Log POS ticket</button><button class="btn" id="hc60_pos_import_btn">Import batch JSON</button><button class="btn" onclick="document.getElementById('modalClose').click()">Close</button>`);
    const saveBtn = document.getElementById('hc60_pos_save_btn');
    const importBtn = document.getElementById('hc60_pos_import_btn');
    if(saveBtn) saveBtn.onclick = function(){
      try{
        recordPosTicket({
          locationId: document.getElementById('hc60_pos_location').value,
          amount: document.getElementById('hc60_pos_amount').value,
          guestName: document.getElementById('hc60_pos_guest_name').value,
          guestEmail: document.getElementById('hc60_pos_guest_email').value,
          guestPhone: document.getElementById('hc60_pos_guest_phone').value,
          channel: document.getElementById('hc60_pos_channel').value,
          items: document.getElementById('hc60_pos_items').value,
          at: document.getElementById('hc60_pos_at').value ? new Date(document.getElementById('hc60_pos_at').value).toISOString() : nowFn(),
          note: document.getElementById('hc60_pos_note').value
        });
        closeModal(); if(typeof render === 'function') render();
      }catch(err){ toastFn(clean(err && err.message) || 'POS save failed.', 'bad'); }
    };
    if(importBtn) importBtn.onclick = function(){
      try{
        const rows = JSON.parse(document.getElementById('hc60_pos_batch').value || '[]');
        const created = importPosRows(rows);
        toastFn('Imported ' + created.length + ' POS rows.', created.length ? 'good' : 'warn');
        closeModal(); if(typeof render === 'function') render();
      }catch(err){ toastFn(clean(err && err.message) || 'POS batch import failed.', 'bad'); }
    };
  }

  function exportPacketSvg(packetId){
    const st = state();
    const packet = readPackets().find(function(item){ return clean(item.id) === clean(packetId); });
    if(!packet) throw new Error('Packet not found.');
    const location = findLocation(st, packet.locationId);
    const svg = packetSvg(packet, location);
    downloadTextFn(svg, 'platform_house_join_packet_' + clean(packet.code || packet.id) + '.svg', 'image/svg+xml');
    appendAudit('join-packet-svg-exported', packet.code + ' exported as SVG.', 'good', { packetId: packet.id, code: packet.code });
    return svg;
  }

  function renderPermissionBadges(op){
    return permissionsFor(op.role).map(function(item){ return `<span class="pill">${esc(item)}</span>`; }).join('');
  }

  function renderV60Panels(){
    if(!(typeof APP !== 'undefined' && APP && APP.view === 'platform-house')) return;
    const host = document.getElementById('content');
    if(!host) return;
    const old = document.getElementById('hc_v60_panel_root');
    if(old && old.remove) old.remove();
    const st = state();
    const stats = buildExtendedStats();
    const packets = readPackets().slice(0, 5);
    const checkins = readCheckins().slice(0, 5);
    const pos = readPosTickets().slice(0, 5);
    const audit = readAudit().slice(0, 8);
    const op = currentOperator();
    const root = document.createElement('div');
    root.id = 'hc_v60_panel_root';
    root.className = 'grid';
    root.style.marginTop = '12px';
    root.innerHTML = `
      <div class="card" style="grid-column:span 12;">
        <h2 style="margin:0 0 8px;">Platform House Command Center · V60</h2>
        <div class="hint">This pass lands local operator RBAC, join-packet check-ins, POS revenue logging, and a unified audit lane inside the same Routex shell.</div>
        <div class="sep"></div>
        <div class="row" style="flex-wrap:wrap; align-items:flex-start; justify-content:space-between;">
          <div>
            <div class="badge good">Active operator • ${esc(op.name)}</div>
            <div class="mini" style="margin-top:8px;">${esc(labelForRole(op.role))}${op.email ? ' • ' + esc(op.email) : ''}</div>
            <div class="row" style="flex-wrap:wrap; margin-top:8px;">${renderPermissionBadges(op)}</div>
          </div>
          <div class="row" style="flex-wrap:wrap; justify-content:flex-end;">
            <button class="btn" id="hc60_operator_btn">Operators</button>
            <button class="btn" id="hc60_packet_btn">Join packets</button>
            <button class="btn" id="hc60_pos_btn">POS lane</button>
            <button class="btn" id="hc60_audit_export_btn">Export audit</button>
            <button class="btn primary" id="hc60_bundle_export_btn">Export full v60 bundle</button>
          </div>
        </div>
      </div>
      <div class="card" style="grid-column:span 4;">
        <h2 style="margin:0 0 8px;">Ops depth</h2>
        <div class="list">
          <div class="item"><div class="meta"><div class="name">Operators</div><div class="sub">${esc(String(stats.operators))} active profiles with local role control</div></div></div>
          <div class="item"><div class="meta"><div class="name">Join packets</div><div class="sub">${esc(String(stats.activePackets))} active • ${esc(String(stats.checkins))} redeemed</div></div></div>
          <div class="item"><div class="meta"><div class="name">POS tickets</div><div class="sub">${esc(String(stats.posTickets))} logged • ${esc(moneyFn(stats.posRevenue))} revenue tracked</div></div></div>
          <div class="item"><div class="meta"><div class="name">Audit rows</div><div class="sub">${esc(String(stats.audit))} cross-lane actions recorded</div></div></div>
        </div>
      </div>
      <div class="card" style="grid-column:span 4;">
        <h2 style="margin:0 0 8px;">Recent join packets</h2>
        <div class="list">${packets.length ? packets.map(function(item){ return `<div class="item"><div class="meta"><div class="name">${esc(item.locationName || 'Location')} <span class="badge">${esc(item.code)}</span></div><div class="sub">${esc(item.offer || 'Member check-in')} • ${esc(item.status)} • ${esc(String(item.scanCount || 0))} redeem(s)</div></div><div class="actions"><button class="btn small" data-hc60-export-packet="${esc(item.id)}">SVG</button><button class="btn small" data-hc60-redeem-packet="${esc(item.code)}">Redeem</button></div></div>`; }).join('') : '<div class="hint">No join packets yet.</div>'}</div>
      </div>
      <div class="card" style="grid-column:span 4;">
        <h2 style="margin:0 0 8px;">Recent POS tickets</h2>
        <div class="list">${pos.length ? pos.map(function(item){ return `<div class="item"><div class="meta"><div class="name">${esc(item.locationName)} <span class="badge">${esc(moneyFn(item.amount))}</span></div><div class="sub">${esc(item.guestName || item.guestEmail || 'Walk-in')} • ${esc(item.channel)} • ${esc(fmtFn(item.at))}</div></div></div>`; }).join('') : '<div class="hint">No POS tickets yet.</div>'}</div>
      </div>
      <div class="card" style="grid-column:span 6;">
        <h2 style="margin:0 0 8px;">Recent check-ins</h2>
        <div class="list">${checkins.length ? checkins.map(function(item){ return `<div class="item"><div class="meta"><div class="name">${esc(item.guestName || item.guestEmail || 'Guest')}</div><div class="sub">${esc(item.code)} • ${esc(item.offer || 'Check-in')} • ${esc(fmtFn(item.at))}</div></div></div>`; }).join('') : '<div class="hint">No member check-ins yet.</div>'}</div>
      </div>
      <div class="card" style="grid-column:span 6;">
        <h2 style="margin:0 0 8px;">Unified audit lane</h2>
        <div class="list">${audit.length ? audit.map(function(item){ return `<div class="item"><div class="meta"><div class="name">${esc(item.action)}</div><div class="sub">${esc(item.operatorName || 'Operator')} • ${esc(fmtFn(item.at))}${item.detail ? ' • ' + esc(item.detail) : ''}</div></div></div>`; }).join('') : '<div class="hint">No audit rows yet.</div>'}</div>
      </div>`;
    host.appendChild(root);
    const opBtn = document.getElementById('hc60_operator_btn');
    const packetBtn = document.getElementById('hc60_packet_btn');
    const posBtn = document.getElementById('hc60_pos_btn');
    const bundleBtn = document.getElementById('hc60_bundle_export_btn');
    const auditBtn = document.getElementById('hc60_audit_export_btn');
    if(opBtn) opBtn.onclick = openOperatorModal;
    if(packetBtn) packetBtn.onclick = function(){ openPacketModal(''); };
    if(posBtn) posBtn.onclick = openPosModal;
    if(bundleBtn) bundleBtn.onclick = function(){ try{ exportFullBundle(); }catch(err){ toastFn(clean(err && err.message) || 'Export failed.', 'bad'); } };
    if(auditBtn) auditBtn.onclick = function(){ try{ exportAuditBundle(); }catch(err){ toastFn(clean(err && err.message) || 'Audit export failed.', 'bad'); } };
    Array.from(document.querySelectorAll('[data-hc60-export-packet]')).forEach(function(btn){ btn.onclick = function(){ try{ exportPacketSvg(btn.getAttribute('data-hc60-export-packet')); }catch(err){ toastFn(clean(err && err.message) || 'Packet export failed.', 'bad'); } }; });
    Array.from(document.querySelectorAll('[data-hc60-redeem-packet]')).forEach(function(btn){ btn.onclick = function(){ openPacketModal(btn.getAttribute('data-hc60-redeem-packet')); }; });
  }

  function injectDashboardSummary(){
    if(!(typeof APP !== 'undefined' && APP && APP.view === 'dashboard')) return;
    const grid = document.querySelector('#content .grid');
    if(!grid) return;
    const old = document.getElementById('hc_v60_dashboard_card');
    if(old && old.remove) old.remove();
    const stats = buildExtendedStats();
    const card = document.createElement('div');
    card.id = 'hc_v60_dashboard_card';
    card.className = 'card';
    card.style.gridColumn = 'span 12';
    card.innerHTML = `<h2>Platform House integral depth</h2><div class="hint">RBAC, check-ins, POS logging, and audit now live in the Routex command surface.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap;"><div class="pill">Operators ${esc(String(stats.operators))}</div><div class="pill">Join packets ${esc(String(stats.activePackets))}</div><div class="pill">Check-ins ${esc(String(stats.checkins))}</div><div class="pill">POS ${esc(String(stats.posTickets))}</div><div class="pill">Revenue ${esc(moneyFn(stats.posRevenue))}</div><button class="btn" id="hc_v60_open_platform">Open command center</button></div>`;
    grid.insertBefore(card, grid.children[1] || null);
    const btn = document.getElementById('hc_v60_open_platform');
    if(btn) btn.onclick = function(){ APP.routeId = null; APP.view = 'platform-house'; window.location.hash = 'platform-house'; if(typeof render === 'function') render(); };
  }

  function injectSettingsSummary(){
    if(!(typeof APP !== 'undefined' && APP && APP.view === 'settings')) return;
    const grid = document.querySelector('#content .grid');
    if(!grid) return;
    const old = document.getElementById('hc_v60_settings_card');
    if(old && old.remove) old.remove();
    const card = document.createElement('div');
    card.id = 'hc_v60_settings_card';
    card.className = 'card';
    card.style.gridColumn = 'span 12';
    card.innerHTML = `<h2>Platform House V60 controls</h2><div class="hint">Export the full v60 bundle or the audit lane directly from settings.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap;"><button class="btn" id="hc_v60_settings_audit">Export audit</button><button class="btn primary" id="hc_v60_settings_bundle">Export full v60 bundle</button></div>`;
    grid.appendChild(card);
    const a = document.getElementById('hc_v60_settings_audit');
    const b = document.getElementById('hc_v60_settings_bundle');
    if(a) a.onclick = function(){ try{ exportAuditBundle(); }catch(err){ toastFn(clean(err && err.message) || 'Audit export failed.', 'bad'); } };
    if(b) b.onclick = function(){ try{ exportFullBundle(); }catch(err){ toastFn(clean(err && err.message) || 'Export failed.', 'bad'); } };
  }

  function permissionForTarget(target){
    const id = target.id || '';
    if(id === 'hc_sync_now' || id === 'hc_new_location' || id === 'hc_new_guest' || id === 'hc_new_event' || id === 'hc_new_campaign' || id === 'hc_new_drop') return 'manage_hospitality';
    if(id === 'hc_export' || id === 'hc_import') return 'export_data';
    if(target.getAttribute && target.getAttribute('data-hc-task-source')) return 'manage_bridge';
    if(target.getAttribute && target.getAttribute('data-hc-route-source')) return 'manage_bridge';
    if(target.getAttribute && (target.getAttribute('data-hc-edit-location') || target.getAttribute('data-hc-edit-guest') || target.getAttribute('data-hc-new-event') || target.getAttribute('data-hc-new-campaign') || target.getAttribute('data-hc-new-drop'))) return 'manage_hospitality';
    return '';
  }

  function installPermissionGuard(){
    if(window.__ROUTEX_HC_V60_GUARD__) return;
    window.__ROUTEX_HC_V60_GUARD__ = true;
    document.addEventListener('click', function(ev){
      const target = ev.target && ev.target.closest ? ev.target.closest('button,[data-hc-task-source],[data-hc-route-source],[data-hc-edit-location],[data-hc-edit-guest],[data-hc-new-event],[data-hc-new-campaign],[data-hc-new-drop]') : null;
      if(!target) return;
      const permission = permissionForTarget(target);
      if(permission && !can(permission)){
        ev.preventDefault();
        ev.stopImmediatePropagation();
        toastFn('Current operator cannot perform that action.', 'bad');
      }
    }, true);
  }

  function wireHashCheckin(){
    function handle(){
      const hash = String((window.location && window.location.hash) || '');
      const prefix = '#platform-house-checkin/';
      if(hash.indexOf(prefix) !== 0) return;
      const code = decodeURIComponent(hash.slice(prefix.length));
      if(typeof APP !== 'undefined' && APP){ APP.routeId = null; APP.view = 'platform-house'; }
      if(typeof render === 'function') render();
      setTimeout(function(){ openPacketModal(code); }, 120);
    }
    if(window.addEventListener) window.addEventListener('hashchange', handle);
    setTimeout(handle, 60);
  }

  function patchApi(){
    const api = base();
    if(!api || api.__v60Patched) return;
    const originalQueue = api.queueRouteTaskFromSource ? api.queueRouteTaskFromSource.bind(api) : null;
    const originalRoute = api.createRouteMissionFromSource ? api.createRouteMissionFromSource.bind(api) : null;
    const originalExport = api.exportUnifiedBundle ? api.exportUnifiedBundle.bind(api) : null;
    const originalImport = api.importUnifiedBundle ? api.importUnifiedBundle.bind(api) : null;
    api.queueRouteTaskFromSource = function(type, id){ requirePermission('manage_bridge'); const out = originalQueue ? originalQueue(type, id) : null; appendAudit('bridge-task-created', String(type) + ' • ' + String(id), 'good', { sourceType:type, sourceId:id }); return out; };
    api.createRouteMissionFromSource = async function(type, id){ requirePermission('manage_bridge'); const out = originalRoute ? await originalRoute(type, id) : null; appendAudit('bridge-route-created', String(type) + ' • ' + String(id), 'good', { sourceType:type, sourceId:id, routeId: out && out.id }); return out; };
    api.exportUnifiedBundle = exportFullBundle;
    api.importUnifiedBundle = importFullBundle;
    api.readOperators = readOperators;
    api.createOperator = createOperator;
    api.switchOperator = switchOperator;
    api.currentOperator = currentOperator;
    api.permissionsForCurrentOperator = function(){ return permissionsFor(currentOperator().role); };
    api.createJoinPacket = createJoinPacket;
    api.redeemJoinPacket = redeemJoinPacket;
    api.readJoinPackets = readPackets;
    api.readCheckins = readCheckins;
    api.recordPosTicket = recordPosTicket;
    api.importPosRows = importPosRows;
    api.readPosTickets = readPosTickets;
    api.readAudit = readAudit;
    api.exportAuditBundle = exportAuditBundle;
    api.buildExtendedStats = buildExtendedStats;
    api.__v60Patched = true;
    api.__v60OriginalExport = originalExport;
    api.__v60OriginalImport = originalImport;
  }

  function patchRender(){
    if(window.__ROUTEX_HC_V60_RENDER__) return;
    window.__ROUTEX_HC_V60_RENDER__ = true;
    const prev = typeof render === 'function' ? render : null;
    if(!prev) return;
    render = async function(){
      const out = await prev.apply(this, arguments);
      raf(function(){
        try{ renderV60Panels(); injectDashboardSummary(); injectSettingsSummary(); }catch(_){ }
      });
      return out;
    };
  }

  function firstRunSeed(){
    readOperators();
    readSession();
    if(!readAudit().length) appendAudit('platform-v60-seeded', 'V60 local operator, join-packet, POS, and audit lanes seeded.', 'good', { version:'v60' });
  }

  function init(){
    if(!base()) return setTimeout(init, 40);
    firstRunSeed();
    patchApi();
    installPermissionGuard();
    patchRender();
    wireHashCheckin();
    raf(function(){ try{ renderV60Panels(); injectDashboardSummary(); injectSettingsSummary(); }catch(_){ } });
    window.RoutexPlatformHouseCircleV60 = {
      readOperators: readOperators,
      currentOperator: currentOperator,
      switchOperator: switchOperator,
      createOperator: createOperator,
      createJoinPacket: createJoinPacket,
      redeemJoinPacket: redeemJoinPacket,
      readJoinPackets: readPackets,
      readCheckins: readCheckins,
      recordPosTicket: recordPosTicket,
      importPosRows: importPosRows,
      readPosTickets: readPosTickets,
      readAudit: readAudit,
      exportAuditBundle: exportAuditBundle,
      exportFullBundle: exportFullBundle,
      importFullBundle: importFullBundle,
      buildExtendedStats: buildExtendedStats,
      can: can,
      permissionsFor: permissionsFor
    };
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
