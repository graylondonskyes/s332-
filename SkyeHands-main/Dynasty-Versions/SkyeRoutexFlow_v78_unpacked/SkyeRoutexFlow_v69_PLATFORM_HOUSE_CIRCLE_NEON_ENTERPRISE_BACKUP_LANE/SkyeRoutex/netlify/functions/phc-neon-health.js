const { clean } = require('./_lib/housecircle-cloud-store');
const { getNeonHealth } = require('./_lib/housecircle-neon-store');
exports.handler = async function(event){
  const orgId = clean(event && event.queryStringParameters && event.queryStringParameters.orgId) || 'default-org';
  const neon = await getNeonHealth(orgId);
  return { statusCode: neon.ok ? 200 : 503, headers:{ 'content-type':'application/json', 'cache-control':'no-store', 'access-control-allow-origin':'*' }, body: JSON.stringify({ ok: !!neon.ok, orgId, neon }) };
};
