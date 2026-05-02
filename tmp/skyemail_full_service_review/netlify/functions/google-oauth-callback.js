const { json } = require('./_utils');
const { query } = require('./_db');
const {
  readOAuthState,
  exchangeGoogleCode,
  fetchGmailProfile,
  saveGoogleMailbox,
  loadGoogleMailbox,
  getWatchConfig,
  enableGoogleWatch,
  updateGoogleMailboxState,
} = require('./_gmail');

function redirect(location) {
  return {
    statusCode: 302,
    headers: {
      Location: location,
      'Cache-Control': 'no-store',
    },
    body: '',
  };
}

exports.handler = async (event) => {
  try {
    if (String(event.httpMethod || 'GET').toUpperCase() !== 'GET') {
      return json(405, { error: 'Method not allowed.' });
    }

    const qs = event.queryStringParameters || {};
    const code = String(qs.code || '').trim();
    const stateToken = String(qs.state || '').trim();
    const error = String(qs.error || '').trim();

    if (error) {
      return redirect(`/onboarding.html?google=error&reason=${encodeURIComponent(error)}`);
    }
    if (!code || !stateToken) {
      return redirect('/onboarding.html?google=error&reason=missing_code_or_state');
    }

    const state = readOAuthState(stateToken);
    const tokenData = await exchangeGoogleCode(code);
    const accessToken = String(tokenData.access_token || '');
    const refreshToken = String(tokenData.refresh_token || '');
    if (!accessToken) {
      return redirect('/onboarding.html?google=error&reason=missing_access_token');
    }

    const profile = await fetchGmailProfile(accessToken);
    const gmailEmail = String(profile.emailAddress || '').trim().toLowerCase();
    if (!gmailEmail) {
      return redirect('/onboarding.html?google=error&reason=missing_google_email');
    }

    const userRes = await query('select handle from users where id=$1 limit 1', [state.sub]);
    const fromName = userRes.rows[0]?.handle || gmailEmail.split('@')[0] || 'Skye Mail';
    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + Number(tokenData.expires_in) * 1000).toISOString()
      : null;

    const existing = await loadGoogleMailbox(state.sub);
    await saveGoogleMailbox(state.sub, {
      google_email: gmailEmail,
      from_name: fromName,
      access_token: accessToken,
      refresh_token: refreshToken || existing?.refresh_token || '',
      token_type: tokenData.token_type || 'Bearer',
      scope: tokenData.scope || '',
      expires_at: expiresAt,
      history_id: profile.historyId || null,
    });

    let watchParam = 'watch=skipped';
    if (getWatchConfig()) {
      try {
        await enableGoogleWatch(state.sub);
        watchParam = 'watch=active';
      } catch (watchErr) {
        await updateGoogleMailboxState(state.sub, {
          watch_status: 'error',
          watch_last_error: watchErr.message || 'watch_failed',
          push_enabled: false,
        });
        watchParam = `watch=error&watch_reason=${encodeURIComponent(watchErr.message || 'watch_failed')}`;
      }
    }

    const next = String(state.next || '/dashboard.html');
    const sep = next.includes('?') ? '&' : '?';
    return redirect(`${next}${sep}google=connected&${watchParam}`);
  } catch (err) {
    return redirect(`/onboarding.html?google=error&reason=${encodeURIComponent(err.message || 'callback_failed')}`);
  }
};
