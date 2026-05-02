const { verifyAuth, json } = require('./_utils');
const { getAuthorizedGmail, gmailRequest } = require('./_gmail');

function decodeBase64UrlToBuffer(input) {
  let value = String(input || '').replace(/-/g, '+').replace(/_/g, '/');
  while (value.length % 4) value += '=';
  return Buffer.from(value, 'base64');
}

exports.handler = async (event) => {
  try {
    if (String(event.httpMethod || 'GET').toUpperCase() !== 'GET') {
      return json(405, { error: 'Method not allowed.' });
    }
    const auth = verifyAuth(event);
    const { accessToken } = await getAuthorizedGmail(auth.sub);
    const qs = event.queryStringParameters || {};
    const messageId = String(qs.messageId || '').trim();
    const attachmentId = String(qs.attachmentId || '').trim();
    const filename = String(qs.filename || 'attachment').trim();
    const mimeType = String(qs.mimeType || 'application/octet-stream').trim();
    if (!messageId || !attachmentId) return json(400, { error: 'messageId and attachmentId are required.' });

    const payload = await gmailRequest(accessToken, `/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`);
    const bytes = decodeBase64UrlToBuffer(payload.data || '');
    return {
      statusCode: 200,
      isBase64Encoded: true,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename.replace(/"/g, '')}"`,
        'Cache-Control': 'no-store',
      },
      body: bytes.toString('base64'),
    };
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Server error' });
  }
};
