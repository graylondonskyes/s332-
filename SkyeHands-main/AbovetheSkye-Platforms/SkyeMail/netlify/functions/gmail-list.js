const { verifyAuth, json } = require('./_utils');
const { getAuthorizedGmail, gmailRequest, parseMessageSummary, touchMailboxAfterList } = require('./_gmail');

exports.handler = async (event) => {
  try {
    if (String(event.httpMethod || 'GET').toUpperCase() !== 'GET') {
      return json(405, { error: 'Method not allowed.' });
    }
    const auth = verifyAuth(event);
    const { accessToken, mailbox } = await getAuthorizedGmail(auth.sub);
    const qs = event.queryStringParameters || {};
    const max = Math.max(1, Math.min(25, Number(qs.max || 20)));
    const pageToken = String(qs.pageToken || '').trim();
    const q = String(qs.q || '').trim();
    const label = String(qs.label || '').trim();

    const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
    url.searchParams.set('maxResults', String(max));
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    if (q) url.searchParams.set('q', q);
    if (label) url.searchParams.append('labelIds', label);

    const list = await gmailRequest(accessToken, url.toString());
    const refs = Array.isArray(list.messages) ? list.messages : [];
    const items = await Promise.all(refs.map(async (item) => {
      const detail = await gmailRequest(
        accessToken,
        `/messages/${encodeURIComponent(item.id)}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`
      );
      return parseMessageSummary(detail);
    }));

    const latestHistoryId = items[0]?.history_id || mailbox.history_id || null;
    await touchMailboxAfterList(auth.sub, latestHistoryId);

    return json(200, {
      ok: true,
      mailbox: mailbox.google_email,
      nextPageToken: list.nextPageToken || null,
      resultSizeEstimate: list.resultSizeEstimate || items.length,
      items,
    });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Server error' });
  }
};
