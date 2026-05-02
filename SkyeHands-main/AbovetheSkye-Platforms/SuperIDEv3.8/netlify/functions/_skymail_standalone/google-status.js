const { verifyAuth, json } = require('./_utils');
const { loadGoogleMailbox, getWatchConfig } = require('./_gmail');

exports.handler = async (event) => {
  try {
    if (String(event.httpMethod || 'GET').toUpperCase() !== 'GET') {
      return json(405, { error: 'Method not allowed.' });
    }
    const auth = verifyAuth(event);
    const mailbox = await loadGoogleMailbox(auth.sub);
    const watchConfigured = Boolean(getWatchConfig());
    return json(200, {
      ok: true,
      connected: Boolean(mailbox),
      watchConfigured,
      mailbox: mailbox
        ? {
            google_email: mailbox.google_email,
            from_name: mailbox.from_name,
            scope: mailbox.scope,
            expires_at: mailbox.expires_at,
            connected_at: mailbox.connected_at,
            updated_at: mailbox.updated_at,
            history_id: mailbox.history_id,
            watch_topic: mailbox.watch_topic,
            watch_expiration: mailbox.watch_expiration,
            watch_status: mailbox.watch_status,
            watch_last_error: mailbox.watch_last_error,
            push_enabled: mailbox.push_enabled,
            sync_version: mailbox.sync_version,
            last_notification_history_id: mailbox.last_notification_history_id,
            last_notification_at: mailbox.last_notification_at,
            last_sync_at: mailbox.last_sync_at,
            full_sync_required: mailbox.full_sync_required,
            contacts_last_sync_at: mailbox.contacts_last_sync_at,
            contacts_last_sync_count: mailbox.contacts_last_sync_count,
            contacts_sync_error: mailbox.contacts_sync_error,
          }
        : null,
    });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Server error' });
  }
};
