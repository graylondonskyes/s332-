const { readOrgState, saveOrgState, clean, compact, upsertDevice, listDevices, pushEvent } = require('./_lib/housecircle-cloud-store');
const { verifySessionToken, extractBearer } = require('./_lib/housecircle-auth');

function cors(){ return { 'content-type':'application/json', 'cache-control':'no-store', 'access-control-allow-origin':'*', 'access-control-allow-headers':'content-type, authorization', 'access-control-allow-methods':'GET,POST,OPTIONS' }; }

exports.handler = async function(event){
  if(event.httpMethod === 'OPTIONS') return { statusCode:204, headers:cors(), body:'' };
  const guard = verifySessionToken(extractBearer(event.headers || {}));
  if(!guard.ok) return { statusCode:401, headers:cors(), body: JSON.stringify({ ok:false, error: guard.error }) };
  const orgId = clean((event.queryStringParameters && event.queryStringParameters.orgId) || (event.body && JSON.parse(event.body).orgId) || guard.payload.orgId) || 'default-org';
  const state = readOrgState(orgId);
  if(event.httpMethod === 'GET'){
    return { statusCode:200, headers:cors(), body: JSON.stringify({ ok:true, orgId, devices: listDevices(state) }) };
  }
  if(event.httpMethod !== 'POST') return { statusCode:405, headers:cors(), body: JSON.stringify({ ok:false, error:'Method not allowed.' }) };
  const body = event.body ? JSON.parse(event.body) : {};
  const device = upsertDevice(state, {
    id: clean(body.deviceId) || clean(guard.payload.deviceId),
    operatorId: clean(body.operatorId) || clean(guard.payload.operatorId),
    operatorName: compact(body.operatorName) || compact(guard.payload.operatorName),
    label: compact(body.label),
    platform: compact(body.platform),
    userAgent: compact(body.userAgent),
    fingerprint: compact(body.fingerprint),
    trusted: body.trusted === undefined ? true : !!body.trusted,
    lastSeenAt: new Date().toISOString()
  });
  pushEvent(state, { kind:'device_register', note:'Device registered or refreshed.', detail:{ deviceId: device.id, trusted: device.trusted } });
  const saved = saveOrgState(orgId, state);
  return { statusCode:200, headers:cors(), body: JSON.stringify({ ok:true, orgId, device, devices:listDevices(saved), revision:saved.revision }) };
};
