const { verifyAuth, parseJson, json } = require('./_utils');
const { getAuthorizedGmail, gmailRequest } = require('./_gmail');

exports.handler = async (event) => {
  try {
    if (String(event.httpMethod || 'POST').toUpperCase() !== 'POST') return json(405, { error: 'Method not allowed.' });
    const auth = verifyAuth(event);
    const body = parseJson(event);
    const ids = Array.isArray(body.ids) ? body.ids.map(String).map((v)=>v.trim()).filter(Boolean) : [];
    const action = String(body.action || 'trash').trim().toLowerCase();
    if (!ids.length) return json(400, { error: 'ids required.' });
    if (!['trash','untrash'].includes(action)) return json(400, { error: 'Invalid action.' });
    const { accessToken } = await getAuthorizedGmail(auth.sub);
    for (const id of ids) {
      await gmailRequest(accessToken, `/messages/${encodeURIComponent(id)}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
    }
    return json(200, { ok:true, count: ids.length, action });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Server error' });
  }
};
