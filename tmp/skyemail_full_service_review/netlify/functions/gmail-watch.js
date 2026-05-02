const { verifyAuth, json } = require('./_utils');
const { enableGoogleWatch, getWatchConfig, stopGoogleWatch, loadGoogleMailbox } = require('./_gmail');

exports.handler = async (event) => {
  try {
    const method = String(event.httpMethod || 'GET').toUpperCase();
    const auth = verifyAuth(event);

    if (method === 'GET') {
      const mailbox = await loadGoogleMailbox(auth.sub);
      const cfg = getWatchConfig();
      return json(200, {
        ok: true,
        configured: Boolean(cfg),
        mailbox: mailbox ? {
          google_email: mailbox.google_email,
          watch_topic: mailbox.watch_topic,
          watch_expiration: mailbox.watch_expiration,
          watch_status: mailbox.watch_status,
          watch_last_error: mailbox.watch_last_error,
          push_enabled: mailbox.push_enabled,
          sync_version: mailbox.sync_version,
          last_notification_at: mailbox.last_notification_at,
          last_sync_at: mailbox.last_sync_at,
          full_sync_required: mailbox.full_sync_required,
        } : null,
      });
    }

    if (method === 'DELETE') {
      const data = await stopGoogleWatch(auth.sub);
      return json(200, { ok: true, ...data });
    }

    if (method !== 'POST') return json(405, { error: 'Method not allowed.' });
    const configured = getWatchConfig();
    if (!configured) return json(400, { error: 'Gmail push watch is not configured yet. Add GMAIL_PUBSUB_TOPIC_NAME first.' });

    const watch = await enableGoogleWatch(auth.sub);
    return json(200, { ok: true, watch });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Server error' });
  }
};
