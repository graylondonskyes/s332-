const { getNeonHealth } = require('./_lib/housecircle-neon-store');
const { requireAuth, authErrorResponse, jsonResponse } = require('./_lib/housecircle-auth');
exports.handler = async function(event){
  if(event.httpMethod === 'OPTIONS') return jsonResponse(204, {});
  if(event.httpMethod !== 'GET') return jsonResponse(405, { ok:false, error:'Method not allowed.' });
  const guard = requireAuth(event, { permission:'write:neon' });
  if(!guard.ok) return authErrorResponse(guard);
  const neon = await getNeonHealth(guard.orgId);
  return jsonResponse(neon.ok ? 200 : 503, { ok: !!neon.ok, orgId:guard.orgId, neon });
};
