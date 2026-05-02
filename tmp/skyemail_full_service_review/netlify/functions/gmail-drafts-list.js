const { verifyAuth, json } = require('./_utils');
const { getAuthorizedGmail, gmailRequest, parseMessageSummary } = require('./_gmail');

exports.handler = async (event) => {
  try {
    if (String(event.httpMethod || 'GET').toUpperCase() !== 'GET') return json(405, { error: 'Method not allowed.' });
    const auth = verifyAuth(event);
    const { accessToken, mailbox } = await getAuthorizedGmail(auth.sub);
    const qs = event.queryStringParameters || {};
    const max = Math.max(1, Math.min(30, Number(qs.max || 20)));
    const pageToken = String(qs.pageToken || '').trim();
    const q = String(qs.q || '').trim();
    const includeSpamTrash = String(qs.includeSpamTrash || 'false').trim() === 'true';

    const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/drafts');
    url.searchParams.set('maxResults', String(max));
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    if (q) url.searchParams.set('q', q);
    if (includeSpamTrash) url.searchParams.set('includeSpamTrash', 'true');

    const list = await gmailRequest(accessToken, url.toString());
    const refs = Array.isArray(list.drafts) ? list.drafts : [];
    const items = [];
    for (const ref of refs) {
      const draft = await gmailRequest(accessToken, `/drafts/${encodeURIComponent(ref.id)}?format=full`);
      const summary = parseMessageSummary(draft.message || {});
      items.push({
        draft_id: draft.id,
        message_id: draft.message?.id || null,
        thread_id: draft.message?.threadId || summary.thread_id || null,
        ...summary,
      });
    }

    return json(200, {
      ok:true,
      mailbox: mailbox.google_email,
      nextPageToken: list.nextPageToken || null,
      resultSizeEstimate: list.resultSizeEstimate || items.length,
      items,
    });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Server error' });
  }
};
