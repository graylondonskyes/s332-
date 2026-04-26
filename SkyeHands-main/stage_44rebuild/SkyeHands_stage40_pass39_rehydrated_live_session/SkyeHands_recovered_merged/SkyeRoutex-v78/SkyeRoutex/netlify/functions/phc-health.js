const { getNeonHealth } = require('./_lib/housecircle-neon-store');
const { readOrgState, bundlePushSummary, clean } = require('./_lib/housecircle-cloud-store');
const { corsHeaders } = require('./_lib/housecircle-cors');

exports.handler = async function(event){
  const cors = (m) => corsHeaders(event, m || 'GET,OPTIONS');
  const orgId = clean(event && event.queryStringParameters && event.queryStringParameters.orgId) || 'default-org';
  const state = readOrgState(orgId);
  const neon = await getNeonHealth(orgId);
  return {
    statusCode: 200,
    headers: cors(),
    body: JSON.stringify({
      ok:true,
      orgId: state.orgId,
      revision: state.revision,
      updatedAt: state.updatedAt,
      summary: bundlePushSummary(state.bundle),
      jobs: state.jobs.filter((row) => row.status !== 'completed').length,
      sessions: state.sessions.length,
      valuation: state.bundle && state.bundle.valuationCurrent ? { totalValue: state.bundle.valuationCurrent.totalValue, asOf: state.bundle.valuationCurrent.asOf, version: state.bundle.valuationCurrent.version } : null,
      walkthrough: state.bundle && state.bundle.walkthroughCurrent ? { title: state.bundle.walkthroughCurrent.title, version: state.bundle.walkthroughCurrent.version, sectionCount: state.bundle.walkthroughCurrent.sectionCount, generatedAt: state.bundle.walkthroughCurrent.generatedAt } : null,
      neon,
      storage: { primary:'file-backed-serverless', backup: neon && neon.configured ? 'neon-postgres' : 'neon-ready-not-configured' }
    })
  };
};
