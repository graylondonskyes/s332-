const { verifyAuth, parseJson, json } = require('./_utils');
const { query } = require('./_db');
const { getAuthorizedGmail, gmailRequest, buildRawMessage, headersToMap } = require('./_gmail');

function htmlEscape(input) {
  return String(input || '').replace(/[&<>"']/g, (ch) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
}

function normalizeAttachments(list) {
  const items = Array.isArray(list) ? list : [];
  let total = 0;
  const safe = [];
  for (const item of items.slice(0, 10)) {
    const filename = String(item?.filename || '').trim();
    const mimeType = String(item?.mime_type || 'application/octet-stream').trim();
    const data = String(item?.data_b64 || '').replace(/\s+/g, '');
    if (!filename || !data) continue;
    const size = Buffer.from(data, 'base64').length;
    total += size;
    safe.push({ filename, mime_type: mimeType || 'application/octet-stream', data_b64: data, size_bytes: size });
  }
  if (total > 18 * 1024 * 1024) {
    const err = new Error('Attachments are too large for this draft lane. Keep total attachment size under 18 MB.');
    err.statusCode = 400;
    throw err;
  }
  return safe;
}

async function resolveFrom(accessToken, mailbox, fallbackName, requestedAlias) {
  const aliasesRes = await gmailRequest(accessToken, '/settings/sendAs');
  const aliases = Array.isArray(aliasesRes.sendAs) ? aliasesRes.sendAs : [];
  const normalizedAlias = String(requestedAlias || '').trim().toLowerCase();
  const alias = aliases.find((item)=> String(item.sendAsEmail || '').toLowerCase() === normalizedAlias) || aliases.find((item)=> item.isDefault) || aliases.find((item)=> String(item.sendAsEmail || '').toLowerCase() === String(mailbox.google_email || '').toLowerCase()) || aliases[0] || null;
  const fromEmail = alias?.sendAsEmail || mailbox.google_email;
  const fromName = String(alias?.displayName || mailbox.from_name || fallbackName || fromEmail.split('@')[0]).trim();
  return { alias, from: `${fromName} <${fromEmail}>`, replyTo: fromEmail };
}

exports.handler = async (event) => {
  try {
    if (String(event.httpMethod || 'POST').toUpperCase() !== 'POST') return json(405, { error: 'Method not allowed.' });
    const auth = verifyAuth(event);
    const body = parseJson(event);
    const id = String(body.id || '').trim();
    const to = String(body.to || '').trim();
    const cc = String(body.cc || '').trim();
    const bcc = String(body.bcc || '').trim();
    const subject = String(body.subject || '').trim();
    const text = String(body.text || '').trim();
    const html = String(body.html || '').trim();
    const threadIdIn = String(body.thread_id || '').trim();
    const replyMessageId = String(body.reply_message_id || '').trim();
    const fromAlias = String(body.from_alias || '').trim();
    const attachments = normalizeAttachments(body.attachments || []);
    if (!to && !cc && !bcc) return json(400, { error: 'Add at least one recipient before saving a draft.' });
    if (!subject) return json(400, { error: 'Subject is required.' });
    if (!text && !html) return json(400, { error: 'Draft body is required.' });

    const { accessToken, mailbox } = await getAuthorizedGmail(auth.sub);
    const userRes = await query('select handle from users where id=$1 limit 1', [auth.sub]);
    const fallbackName = mailbox.from_name || userRes.rows[0]?.handle || mailbox.google_email.split('@')[0];
    const fromInfo = await resolveFrom(accessToken, mailbox, fallbackName, fromAlias);
    let threadHeaders = {};
    let threadId = threadIdIn || '';
    if (replyMessageId) {
      const original = await gmailRequest(accessToken, `/messages/${encodeURIComponent(replyMessageId)}?format=metadata&metadataHeaders=Message-ID&metadataHeaders=References&metadataHeaders=Subject`);
      const hdrs = headersToMap(original?.payload?.headers || []);
      threadHeaders = {
        'in-reply-to': hdrs['message-id'] || '',
        references: [hdrs.references || '', hdrs['message-id'] || ''].filter(Boolean).join(' ').trim(),
      };
      if (!threadId) threadId = original.threadId || '';
    }
    const htmlBody = html || `<div style="font-family:Arial,sans-serif;white-space:pre-wrap;line-height:1.55">${htmlEscape(text).replace(/\n/g, '<br/>')}</div>`;
    const raw = buildRawMessage({
      from: fromInfo.from,
      to,
      cc,
      bcc,
      subject,
      text: text || html.replace(/<[^>]+>/g, ' '),
      html: htmlBody,
      replyTo: fromInfo.replyTo,
      threadHeaders,
      attachments,
    });
    const message = threadId ? { raw, threadId } : { raw };
    const endpoint = id ? `/drafts/${encodeURIComponent(id)}` : '/drafts';
    const method = id ? 'PUT' : 'POST';
    const saved = await gmailRequest(accessToken, endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(id ? { id, message } : { message }),
    });
    return json(200, {
      ok:true,
      mailbox: mailbox.google_email,
      from_alias: fromInfo.alias?.sendAsEmail || mailbox.google_email,
      draft: {
        id: saved.id,
        message_id: saved.message?.id || null,
        thread_id: saved.message?.threadId || null,
      }
    });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Server error' });
  }
};
