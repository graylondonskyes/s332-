
const H = require('../skyesol-whiteglove-runtime/shared');
const SERVICE = 'skyesol-whiteglove-memberships';
const PLAN_TYPES = ['access-only','monthly included-hours','monthly included-hours-and-miles','corporate retainer'];
function buildMemberStatement(membershipId){
  const membership = H.findById('memberships', membershipId);
  if(!membership) return { ok:false, error:'membership_not_found', membershipId };
  const profile = H.findById('serviceProfiles', membership.serviceProfileId) || null;
  const ledgerRows = H.getStore('membershipLedger').filter(row => H.clean(row.membershipId) === H.clean(membership.id));
  const usage = ledgerRows.reduce((acc, row) => { acc.drawCount += H.clean(row.type) === 'draw' ? 1 : 0; acc.hoursUsed += H.toNum(row.hoursUsed || 0, 0); acc.milesUsed += H.toNum(row.milesUsed || 0, 0); return acc; }, { drawCount:0, hoursUsed:0, milesUsed:0 });
  return { ok:true, statement:{ id:H.uid('wg_member_stmt57'), createdAt:H.iso(), membership, profile, usage, ledgerCount:ledgerRows.length } };
}

function route(request){
  const auth = H.checkToken(request, SERVICE); if(auth) return auth;
  const path = H.clean(request && request.path || '/') || '/';
  const method = H.clean(request && request.method || 'GET').toUpperCase();
  const body = H.parseBody(request);
  if(path === '/health') return H.json(H.responseEnvelope(SERVICE,{ status:'healthy', counts:{ memberships:H.getStore('memberships').length, ledger:H.getStore('membershipLedger').length } }));
  if(path === '/schema') return H.json(H.responseEnvelope(SERVICE,{ enums:{ planTypes:PLAN_TYPES }, routes:['GET /health','GET /schema','GET /memberships','POST /memberships','POST /draw','POST /adjust','POST /member-statement'] }));
  if(path === '/memberships'){
    if(method === 'GET') return H.json(H.responseEnvelope(SERVICE,{ rows:H.clone(H.getStore('memberships')), ledger:H.clone(H.getStore('membershipLedger')) }));
    if(method !== 'POST') return H.methodNotAllowed(method,['GET','POST']);
    const missing = H.requireFields(body,['serviceProfileId','planType']);
    if(missing.length) return H.badRequest(SERVICE,'Missing membership fields.',{ missing });
    const row = {
      id:H.uid('wg_mem49'), serviceProfileId:H.clean(body.serviceProfileId), planType:H.clean(body.planType),
      cadence:H.clean(body.cadence || 'monthly'), includedHours:H.toNum(body.includedHours || 0, 0), includedMiles:H.toNum(body.includedMiles || 0, 0),
      remainingHours:H.toNum(body.includedHours || 0, 0), remainingMiles:H.toNum(body.includedMiles || 0, 0), status:H.clean(body.status || 'active'), createdAt:H.iso(), updatedAt:H.iso()
    };
    H.pushStore('memberships', row, 2000);
    return H.json(H.responseEnvelope(SERVICE,{ membership: row }), 201);
  }
  if(path === '/draw'){
    if(method !== 'POST') return H.methodNotAllowed(method,['POST']);
    const missing = H.requireFields(body,['membershipId','bookingId']);
    if(missing.length) return H.badRequest(SERVICE,'Missing membership draw fields.',{ missing });
    const membership = H.updateById('memberships', body.membershipId, row => {
      const hoursUsed = Math.max(0, H.toNum(body.hoursUsed || 0, 0));
      const milesUsed = Math.max(0, H.toNum(body.milesUsed || 0, 0));
      row.remainingHours = Math.max(0, H.toNum(row.remainingHours || 0, 0) - hoursUsed);
      row.remainingMiles = Math.max(0, H.toNum(row.remainingMiles || 0, 0) - milesUsed);
      row.updatedAt = H.iso();
      return row;
    });
    if(!membership) return H.badRequest(SERVICE,'Membership not found.',{ membershipId: body.membershipId });
    const ledger = { id:H.uid('wg_mdraw49'), membershipId:membership.id, bookingId:H.clean(body.bookingId), type:'draw', hoursUsed:H.toNum(body.hoursUsed || 0,0), milesUsed:H.toNum(body.milesUsed || 0,0), createdAt:H.iso() };
    H.pushStore('membershipLedger', ledger, 4000);
    return H.json(H.responseEnvelope(SERVICE,{ membership, ledger }));
  }
  if(path === '/member-statement'){
    if(method !== 'POST') return H.methodNotAllowed(method,['POST']);
    const missing = H.requireFields(body,['membershipId']);
    if(missing.length) return H.badRequest(SERVICE,'Missing member-statement fields.',{ missing });
    const statement = buildMemberStatement(body.membershipId);
    if(!statement.ok) return H.badRequest(SERVICE,'Membership not found.',{ membershipId: body.membershipId });
    return H.json(H.responseEnvelope(SERVICE, statement));
  }
  if(path === '/adjust'){
    if(method !== 'POST') return H.methodNotAllowed(method,['POST']);
    const missing = H.requireFields(body,['membershipId']);
    if(missing.length) return H.badRequest(SERVICE,'Missing membership adjustment fields.',{ missing });
    const membership = H.updateById('memberships', body.membershipId, row => {
      row.remainingHours = Math.max(0, H.toNum(row.remainingHours || 0, 0) + H.toNum(body.hoursDelta || 0, 0));
      row.remainingMiles = Math.max(0, H.toNum(row.remainingMiles || 0, 0) + H.toNum(body.milesDelta || 0, 0));
      row.updatedAt = H.iso();
      return row;
    });
    if(!membership) return H.badRequest(SERVICE,'Membership not found.',{ membershipId: body.membershipId });
    const ledger = { id:H.uid('wg_madj49'), membershipId:membership.id, bookingId:H.clean(body.bookingId || ''), type:'adjustment', hoursDelta:H.toNum(body.hoursDelta || 0,0), milesDelta:H.toNum(body.milesDelta || 0,0), note:H.clean(body.note || ''), createdAt:H.iso() };
    H.pushStore('membershipLedger', ledger, 4000);
    return H.json(H.responseEnvelope(SERVICE,{ membership, ledger }));
  }
  return H.notFound(SERVICE, method, path);
}
if(typeof module !== 'undefined') module.exports = { route };
