const { verifyAuth, parseJson, json } = require('./_utils');
const { getAuthorizedGmail, gmailRequest } = require('./_gmail');

exports.handler = async (event) => {
  try {
    if (String(event.httpMethod || 'POST').toUpperCase() !== 'POST') return json(405, { error: 'Method not allowed.' });
    const auth = verifyAuth(event);
    const body = parseJson(event);
    const ids = Array.isArray(body.ids) ? body.ids.map(String).map((v)=>v.trim()).filter(Boolean) : [];
    if (!ids.length) return json(400, { error: 'ids required.' });
    if (ids.length > 1000) return json(400, { error: 'Maximum 1000 ids per request.' });
    const { accessToken } = await getAuthorizedGmail(auth.sub);
    await gmailRequest(accessToken, '/messages/batchDelete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    return json(200, { ok:true, count: ids.length });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Server error' });
  }
};
