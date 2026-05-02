const { getNeonHealth } = require('./_lib/housecircle-neon-store');
const { bundlePushSummary } = require('./_lib/housecircle-cloud-store');
const { requireAuth, authErrorResponse, jsonResponse } = require('./_lib/housecircle-auth');
const { productionReadiness } = require('./_lib/housecircle-runtime-guard');
exports.handler = async function(event){
  if(event.httpMethod === 'OPTIONS') return jsonResponse(204, {});
  if(event.httpMethod !== 'GET') return jsonResponse(405, { ok:false, error:'Method not allowed.' });
  const guard = requireAuth(event, { permission:'view:org' });
  if(!guard.ok) return authErrorResponse(guard);
  const state = guard.state;
  const neon = await getNeonHealth(guard.orgId);
  const readiness = productionReadiness();
  return jsonResponse(200, { ok:true, orgId: state.orgId, revision: state.revision, updatedAt: state.updatedAt, summary: bundlePushSummary(state.bundle), jobs: state.jobs.filter((row) => row.status !== 'completed').length, sessions: state.sessions.length, valuation: state.bundle && state.bundle.valuationCurrent ? { totalValue: state.bundle.valuationCurrent.totalValue, asOf: state.bundle.valuationCurrent.asOf, version: state.bundle.valuationCurrent.version } : null, walkthrough: state.bundle && state.bundle.walkthroughCurrent ? { title: state.bundle.walkthroughCurrent.title, version: state.bundle.walkthroughCurrent.version, sectionCount: state.bundle.walkthroughCurrent.sectionCount, generatedAt: state.bundle.walkthroughCurrent.generatedAt } : null, neon, storage: { primary: neon && neon.configured ? (readiness.requireNeonPrimary ? 'neon-required-configured' : 'file-primary-with-neon-mirror') : 'file-primary-local-only', productionReady:readiness.ok, productionRequirement:'set PHC_REQUIRE_NEON_PRIMARY=1 and NEON_DATABASE_URL to require Neon-primary writes; this endpoint is not deployed DNS/SSL proof' }, readiness });
};
