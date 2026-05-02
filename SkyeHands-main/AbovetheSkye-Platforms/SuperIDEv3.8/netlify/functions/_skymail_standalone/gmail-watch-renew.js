const { json } = require('./_utils');
const { listWatchRenewalCandidates, enableGoogleWatch, updateGoogleMailboxState } = require('./_gmail');

exports.handler = async () => {
  try {
    const rows = await listWatchRenewalCandidates(50);
    const results = [];
    for (const row of rows) {
      try {
        const watch = await enableGoogleWatch(row.user_id);
        results.push({ user_id: row.user_id, google_email: row.google_email, ok: true, expiration: watch.expiration });
      } catch (err) {
        await updateGoogleMailboxState(row.user_id, {
          watch_status: 'error',
          watch_last_error: err.message || 'watch_renew_failed',
          push_enabled: true,
        });
        results.push({ user_id: row.user_id, google_email: row.google_email, ok: false, error: err.message || 'watch_renew_failed' });
      }
    }
    return json(200, { ok: true, renewed: results.length, results });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Server error' });
  }
};
