const { verifyAuth, json } = require('./_utils');
const { query } = require('./_db');
const { stopGoogleWatch } = require('./_gmail');

exports.handler = async (event) => {
  try {
    if (String(event.httpMethod || 'POST').toUpperCase() !== 'POST') {
      return json(405, { error: 'Method not allowed.' });
    }
    const auth = verifyAuth(event);
    try { await stopGoogleWatch(auth.sub); } catch {}
    await query('delete from google_mailboxes where user_id=$1', [auth.sub]);
    return json(200, { ok: true });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Server error' });
  }
};
