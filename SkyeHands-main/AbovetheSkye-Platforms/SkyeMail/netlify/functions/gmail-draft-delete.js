const { verifyAuth, parseJson, json } = require('./_utils');
const { getAuthorizedGmail, gmailRequest } = require('./_gmail');

exports.handler = async (event) => {
  try {
    if (String(event.httpMethod || 'POST').toUpperCase() !== 'POST') return json(405, { error: 'Method not allowed.' });
    const auth = verifyAuth(event);
    const body = parseJson(event);
    const id = String(body.id || '').trim();
    if (!id) return json(400, { error: 'id required.' });
    const { accessToken } = await getAuthorizedGmail(auth.sub);
    await gmailRequest(accessToken, `/drafts/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return json(200, { ok:true, id });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Server error' });
  }
};
