const { providerHealth } = require('./_lib/housecircle-payment-providers');
const { requireAuth, authErrorResponse, jsonResponse } = require('./_lib/housecircle-auth');
exports.handler = async function(event){
  if(event.httpMethod === 'OPTIONS') return jsonResponse(204, {});
  if(event.httpMethod !== 'GET') return jsonResponse(405, { ok:false, error:'Method not allowed.' });
  const guard = requireAuth(event, { permission:'view:org' });
  if(!guard.ok) return authErrorResponse(guard);
  return jsonResponse(200, { ok:true, orgId:guard.orgId, providers:providerHealth(), note:'Config/network readiness only. No money movement is claimed.' });
};
