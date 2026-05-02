const { verifyAuth, parseJson, json } = require('./_utils');
const { getAuthorizedGmail, gmailRequest } = require('./_gmail');

exports.handler = async (event) => {
  try {
    if (String(event.httpMethod || 'POST').toUpperCase() !== 'POST') {
      return json(405, { error: 'Method not allowed.' });
    }
    const auth = verifyAuth(event);
    const body = parseJson(event);
    const id = String(body.id || '').trim();
    const addLabelIds = Array.isArray(body.addLabelIds) ? body.addLabelIds.map(String) : [];
    const removeLabelIds = Array.isArray(body.removeLabelIds) ? body.removeLabelIds.map(String) : [];
    if (!id) return json(400, { error: 'id required.' });
    const { accessToken } = await getAuthorizedGmail(auth.sub);
    const result = await gmailRequest(accessToken, `/messages/${encodeURIComponent(id)}/modify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addLabelIds, removeLabelIds }),
    });
    return json(200, { ok: true, labels: result.labelIds || [] });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Server error' });
  }
};
