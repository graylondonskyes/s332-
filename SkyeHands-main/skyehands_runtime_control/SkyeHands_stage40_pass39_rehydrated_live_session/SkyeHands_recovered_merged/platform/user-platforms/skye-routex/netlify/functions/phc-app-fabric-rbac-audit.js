const fabric = require('./_lib/platform-app-fabric');
const { requireAuth, authErrorResponse, jsonResponse } = require('./_lib/housecircle-auth');
exports.handler = async function(event){
  if(event.httpMethod === 'OPTIONS') return jsonResponse(204, {});
  if(event.httpMethod && !['GET','POST'].includes(event.httpMethod)) return jsonResponse(405, { ok:false, error:'Method not allowed.' });
  const body = fabric.parseBody(event) || {};
  const guard = requireAuth(event, { body, permission:'manage:app_fabric' });
  if(!guard.ok) return authErrorResponse(guard);
  return fabric.ok(fabric.auditRbac(guard.orgId));
};
