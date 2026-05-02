const { verifyAuth, json } = require('./_utils');
const { buildGoogleAuthUrl, createOAuthState } = require('./_gmail');

exports.handler = async (event) => {
  try {
    if (String(event.httpMethod || 'GET').toUpperCase() !== 'GET') {
      return json(405, { error: 'Method not allowed.' });
    }
    const auth = verifyAuth(event);
    const next = event.queryStringParameters && event.queryStringParameters.next
      ? String(event.queryStringParameters.next).trim()
      : '/dashboard.html';
    const mode = event.queryStringParameters && event.queryStringParameters.mode
      ? String(event.queryStringParameters.mode).trim().toLowerCase()
      : '';
    const state = createOAuthState({ sub: auth.sub, next });
    const url = buildGoogleAuthUrl({ state });
    if (mode === 'json') return json(200, { ok: true, url });
    return {
      statusCode: 302,
      headers: {
        Location: url,
        'Cache-Control': 'no-store',
      },
      body: '',
    };
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Server error' });
  }
};
