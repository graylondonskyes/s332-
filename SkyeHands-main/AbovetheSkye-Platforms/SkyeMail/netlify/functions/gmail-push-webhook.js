const { json } = require('./_utils');
const { verifyPubSubPushJwt } = require('./_pubsub');
const {
  decodeBase64Url,
  findGoogleMailboxUsersByEmail,
  updateGoogleMailboxState,
  syncMailboxHistory,
} = require('./_gmail');

function decodePubsubMessageData(input) {
  if (!input) return {};
  try {
    return JSON.parse(decodeBase64Url(input));
  } catch {
    let value = String(input).replace(/-/g, '+').replace(/_/g, '/');
    while (value.length % 4) value += '=';
    return JSON.parse(Buffer.from(value, 'base64').toString('utf8'));
  }
}

exports.handler = async (event) => {
  try {
    if (String(event.httpMethod || 'POST').toUpperCase() !== 'POST') {
      return json(405, { error: 'Method not allowed.' });
    }

    await verifyPubSubPushJwt(event);

    const body = event.body ? JSON.parse(event.body) : {};
    const envelope = body?.message || {};
    const payload = decodePubsubMessageData(envelope.data || '');
    const emailAddress = String(payload.emailAddress || '').trim().toLowerCase();
    const notificationHistoryId = String(payload.historyId || '').trim();

    if (!emailAddress || !notificationHistoryId) {
      return json(200, { ok: true, ignored: true, reason: 'missing_email_or_history' });
    }

    const targets = await findGoogleMailboxUsersByEmail(emailAddress);
    if (!targets.length) {
      return json(200, { ok: true, ignored: true, reason: 'mailbox_not_connected_here', emailAddress });
    }

    const results = [];
    for (const row of targets) {
      const userId = row.user_id;
      const priorHistoryId = String(row.history_id || '').trim();
      try {
        if (!priorHistoryId) {
          await updateGoogleMailboxState(userId, {
            history_id: notificationHistoryId,
            last_notification_history_id: notificationHistoryId,
            last_notification_at: new Date().toISOString(),
            last_sync_at: new Date().toISOString(),
            watch_status: 'active',
            watch_last_error: null,
            push_enabled: true,
            full_sync_required: false,
            sync_version_inc: 1,
          });
          results.push({ user_id: userId, mode: 'seeded', latestHistoryId: notificationHistoryId, changeCount: 0 });
          continue;
        }

        const sync = await syncMailboxHistory(userId, priorHistoryId);
        await updateGoogleMailboxState(userId, {
          history_id: sync.latestHistoryId || notificationHistoryId,
          last_notification_history_id: notificationHistoryId,
          last_notification_at: new Date().toISOString(),
          last_sync_at: new Date().toISOString(),
          watch_status: 'active',
          watch_last_error: null,
          push_enabled: true,
          full_sync_required: false,
          sync_version_inc: 1,
        });
        results.push({ user_id: userId, mode: 'history', latestHistoryId: sync.latestHistoryId, changeCount: sync.changeCount });
      } catch (err) {
        if (Number(err.statusCode || 0) === 404) {
          await updateGoogleMailboxState(userId, {
            history_id: notificationHistoryId,
            last_notification_history_id: notificationHistoryId,
            last_notification_at: new Date().toISOString(),
            last_sync_at: new Date().toISOString(),
            watch_status: 'active',
            watch_last_error: 'History gap detected. The UI should perform a fresh inbox sync.',
            push_enabled: true,
            full_sync_required: true,
            sync_version_inc: 1,
          });
          results.push({ user_id: userId, mode: 'history_gap', latestHistoryId: notificationHistoryId, changeCount: 0 });
          continue;
        }
        await updateGoogleMailboxState(userId, {
          last_notification_history_id: notificationHistoryId,
          last_notification_at: new Date().toISOString(),
          watch_status: 'error',
          watch_last_error: err.message || 'push_processing_failed',
          push_enabled: true,
        });
        results.push({ user_id: userId, mode: 'error', error: err.message || 'push_processing_failed' });
      }
    }

    return json(200, { ok: true, emailAddress, historyId: notificationHistoryId, results });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Server error' });
  }
};
