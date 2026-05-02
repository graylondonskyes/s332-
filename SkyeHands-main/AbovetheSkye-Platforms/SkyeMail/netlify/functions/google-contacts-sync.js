const { verifyAuth, json } = require('./_utils');
const { syncGoogleContacts } = require('./_people');

exports.handler = async (event) => {
  try {
    if (!['POST', 'GET'].includes(String(event.httpMethod || 'GET').toUpperCase())) {
      return json(405, { error: 'Method not allowed.' });
    }
    const auth = verifyAuth(event);
    const data = await syncGoogleContacts(auth.sub);
    return json(200, { ok: true, ...data });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Server error' });
  }
};
