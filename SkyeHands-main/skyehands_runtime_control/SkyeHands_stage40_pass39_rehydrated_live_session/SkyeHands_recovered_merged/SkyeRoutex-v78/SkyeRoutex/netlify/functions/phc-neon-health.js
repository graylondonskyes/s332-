const { clean } = require('./_lib/housecircle-cloud-store');
const { getNeonHealth } = require('./_lib/housecircle-neon-store');
const { corsHeaders } = require('./_lib/housecircle-cors');

exports.handler = async function(event){
  const cors = (m) => corsHeaders(event, m || 'GET,OPTIONS');
  const orgId = clean(event && event.queryStringParameters && event.queryStringParameters.orgId) || 'default-org';
  const neon = await getNeonHealth(orgId);
  return { statusCode: neon.ok ? 200 : 503, headers:cors(), body: JSON.stringify({ ok: !!neon.ok, orgId, neon }) };
};
