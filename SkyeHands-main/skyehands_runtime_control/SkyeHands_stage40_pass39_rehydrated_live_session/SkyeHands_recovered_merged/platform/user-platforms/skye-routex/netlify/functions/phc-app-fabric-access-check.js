const fabric = require('./_lib/platform-app-fabric');
const { clean } = require('./_lib/housecircle-cloud-store');
const { requireAuth, authErrorResponse, jsonResponse } = require('./_lib/housecircle-auth');
exports.handler = async function(event){
  if(event.httpMethod === 'OPTIONS') return jsonResponse(204, {});
  if(!['GET','POST'].includes(event.httpMethod)) return jsonResponse(405, { ok:false, error:'Method not allowed.' });
  let body = {};
  try{ body = event.httpMethod === 'POST' && event.body ? JSON.parse(event.body) : {}; }catch(_){ return jsonResponse(400, { ok:false, error:'Invalid JSON body.' }); }
  const guard = requireAuth(event, { body, permission:'view:app' });
  if(!guard.ok) return authErrorResponse(guard);
  const qs = event.queryStringParameters || {};
  const appSlug = clean(body.appSlug || qs.appSlug);
  const permission = clean(body.permission || qs.permission || 'view:app');
  if(!appSlug) return jsonResponse(400, { ok:false, error:'appSlug is required.' });
  let state = fabric.readState(guard.orgId);
  if(!state.rbacPolicies || !state.rbacPolicies.length){ fabric.seedRbac(guard.orgId); state = fabric.readState(guard.orgId); }
  const role = clean(guard.payload.role || 'viewer').toLowerCase();
  const direct = fabric.canAccessApp(state, role, appSlug, permission);
  const adminView = permission === 'view:app' && fabric.canAccessApp(state, role, appSlug, 'manage:app');
  const allowed = !!(direct || adminView);
  return jsonResponse(allowed ? 200 : 403, { ok:allowed, orgId:guard.orgId, appSlug, role, permission, allowed, enforcement:'route-level-rbac-check' });
};
