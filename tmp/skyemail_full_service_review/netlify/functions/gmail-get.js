const { verifyAuth, json } = require('./_utils');
const { getAuthorizedGmail, gmailRequest, headersToMap, extractBodies } = require('./_gmail');

exports.handler = async (event) => {
  try {
    if (String(event.httpMethod || 'GET').toUpperCase() !== 'GET') {
      return json(405, { error: 'Method not allowed.' });
    }
    const auth = verifyAuth(event);
    const { accessToken, mailbox } = await getAuthorizedGmail(auth.sub);
    const qs = event.queryStringParameters || {};
    const id = String(qs.id || '').trim();
    if (!id) return json(400, { error: 'id required.' });

    const detail = await gmailRequest(accessToken, `/messages/${encodeURIComponent(id)}?format=full`);
    const headers = headersToMap(detail?.payload?.headers || []);
    const body = extractBodies(detail?.payload || {});

    return json(200, {
      ok: true,
      mailbox: mailbox.google_email,
      message: {
        id: detail.id,
        thread_id: detail.threadId,
        snippet: detail.snippet || '',
        labels: Array.isArray(detail.labelIds) ? detail.labelIds : [],
        internal_date: detail.internalDate ? new Date(Number(detail.internalDate)).toISOString() : null,
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
        body: {
          text: body.text || '',
          html: body.html || '',
        },
        attachments: body.attachments,
      },
    });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Server error' });
  }
};
