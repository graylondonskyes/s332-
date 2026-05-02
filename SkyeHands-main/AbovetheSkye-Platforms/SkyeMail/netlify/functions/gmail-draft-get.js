const { verifyAuth, json } = require('./_utils');
const { getAuthorizedGmail, gmailRequest, headersToMap, extractBodies } = require('./_gmail');

async function enrichDraftAttachments(accessToken, messageId, attachments) {
  const list = Array.isArray(attachments) ? attachments : [];
  const out = [];
  for (const item of list.slice(0, 6)) {
    const next = { ...item };
    if (messageId && item.attachment_id && Number(item.size || 0) <= 5 * 1024 * 1024) {
      try {
        const data = await gmailRequest(accessToken, `/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(item.attachment_id)}`);
        let normalized = String(data?.data || '').replace(/-/g, '+').replace(/_/g, '/');
        while (normalized.length % 4) normalized += '=';
        next.data_b64 = normalized;
      } catch (_err) {}
    }
    out.push(next);
  }
  return out;
}

exports.handler = async (event) => {
  try {
    if (String(event.httpMethod || 'GET').toUpperCase() !== 'GET') return json(405, { error: 'Method not allowed.' });
    const auth = verifyAuth(event);
    const { accessToken, mailbox } = await getAuthorizedGmail(auth.sub);
    const qs = event.queryStringParameters || {};
    const id = String(qs.id || '').trim();
    if (!id) return json(400, { error: 'id required.' });
    const draft = await gmailRequest(accessToken, `/drafts/${encodeURIComponent(id)}?format=full`);
    const message = draft.message || {};
    const headers = headersToMap(message?.payload?.headers || []);
    const body = extractBodies(message?.payload || {});
    const attachments = await enrichDraftAttachments(accessToken, message.id, body.attachments || []);
    return json(200, {
      ok:true,
      mailbox: mailbox.google_email,
      draft: {
        id: draft.id,
        message_id: message.id,
        thread_id: message.threadId,
        snippet: message.snippet || '',
        internal_date: message.internalDate ? new Date(Number(message.internalDate)).toISOString() : null,
        to: headers.to || '',
        cc: headers.cc || '',
        bcc: headers.bcc || '',
        from: headers.from || '',
        subject: headers.subject || '',
        body: { text: body.text || '', html: body.html || '' },
        attachments,
      }
    });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Server error' });
  }
};
