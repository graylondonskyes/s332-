const { verifyAuth, json } = require('./_utils');
const { getAuthorizedGmail, gmailRequest, headersToMap, extractBodies } = require('./_gmail');

function normalizeMessage(message) {
  const headers = headersToMap(message?.payload?.headers || []);
  const body = extractBodies(message?.payload || {});
  const labelIds = Array.isArray(message?.labelIds) ? message.labelIds : [];
  return {
    id: message.id,
    thread_id: message.threadId,
    history_id: message.historyId || null,
    snippet: message.snippet || '',
    labels: labelIds,
    unread: labelIds.includes('UNREAD'),
    starred: labelIds.includes('STARRED'),
    important: labelIds.includes('IMPORTANT'),
    internal_date: message.internalDate ? new Date(Number(message.internalDate)).toISOString() : null,
    headers: {
      from: headers.from || '',
      to: headers.to || '',
      cc: headers.cc || '',
      subject: headers.subject || '(no subject)',
      date: headers.date || '',
      message_id: headers['message-id'] || '',
      references: headers.references || '',
      in_reply_to: headers['in-reply-to'] || '',
    },
    body: { text: body.text || '', html: body.html || '' },
    attachments: body.attachments,
  };
}

exports.handler = async (event) => {
  try {
    if (String(event.httpMethod || 'GET').toUpperCase() !== 'GET') return json(405, { error: 'Method not allowed.' });
    const auth = verifyAuth(event);
    const { accessToken, mailbox } = await getAuthorizedGmail(auth.sub);
    const qs = event.queryStringParameters || {};
    const id = String(qs.id || '').trim();
    if (!id) return json(400, { error: 'id required.' });
    const detail = await gmailRequest(accessToken, `/threads/${encodeURIComponent(id)}?format=full`);
    const messages = Array.isArray(detail.messages) ? detail.messages.map(normalizeMessage) : [];
    const participants = Array.from(new Set(messages.flatMap((m)=>[m.headers.from, m.headers.to, m.headers.cc]).filter(Boolean)));
    return json(200, {
      ok:true,
      mailbox: mailbox.google_email,
      thread: {
        id: detail.id,
        history_id: detail.historyId || null,
        message_count: messages.length,
        subject: messages[0]?.headers?.subject || '(no subject)',
        participants,
        messages,
      }
    });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Server error' });
  }
};
