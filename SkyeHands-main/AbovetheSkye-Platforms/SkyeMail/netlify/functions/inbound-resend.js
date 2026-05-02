const { Webhook } = require("svix");
const { query } = require("./_db");
const { json, hybridEncryptNode, hybridEncryptBytesNode, requireEnv } = require("./_utils");

function extractAddress(s){
  const m = String(s || "").match(/<([^>]+)>/);
  return (m ? m[1] : String(s || "")).trim().toLowerCase();
}

function handleFromAddress(addr){
  const email = extractAddress(addr);
  const local = email.split("@")[0] || "";
  return local.split("+")[0].trim().toLowerCase();
}

async function resendGet(path){
  const key = requireEnv("RESEND_API_KEY");
  const res = await fetch(`https://api.resend.com${path}`, {
    headers: { "Authorization": `Bearer ${key}` }
  });
  const text = await res.text();
  let data = null;
  try{ data = text ? JSON.parse(text) : null; }catch(e){ data = { raw: text }; }
  if(!res.ok) throw new Error((data && data.message) || (data && data.error) || text || `Resend GET failed (${res.status})`);
  return data;
}

function htmlToText(html){
  return String(html || "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

async function verifyWebhook(event){
  const secret = requireEnv("RESEND_WEBHOOK_SECRET");
  const wh = new Webhook(secret);
  const payload = event.body || "";
  const hdr = event.headers || {};
  const headers = {
    "svix-id": hdr["svix-id"] || hdr["Svix-Id"] || hdr["SVIX-ID"],
    "svix-timestamp": hdr["svix-timestamp"] || hdr["Svix-Timestamp"] || hdr["SVIX-TIMESTAMP"],
    "svix-signature": hdr["svix-signature"] || hdr["Svix-Signature"] || hdr["SVIX-SIGNATURE"]
  };
  return wh.verify(payload, headers);
}

exports.handler = async (event) => {
  try{
    if(event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

    const verified = await verifyWebhook(event);
    if(!verified || verified.type !== "email.received") return json(200, { ok: true, ignored: true });

    const emailId = verified.data && verified.data.email_id;
    if(!emailId) return json(200, { ok: true, ignored: true, reason: "missing_email_id" });

    const received = await resendGet(`/emails/receiving/${encodeURIComponent(emailId)}`);
    const recipients = Array.isArray(received.to) ? received.to : [];
    const handles = Array.from(new Set(recipients.map(handleFromAddress).filter(Boolean)));
    if(!handles.length) return json(200, { ok: true, ignored: true, reason: "no_handles" });

    const created = [];
    for(const handle of handles){
      const userRes = await query(
        `select u.id, u.handle, uk.version, uk.rsa_public_key_pem
         from users u
         join user_keys uk on uk.user_id = u.id and uk.is_active = true
         where lower(u.handle) = $1
         limit 1`,
        [handle]
      );
      if(!userRes.rows.length) continue;
      const user = userRes.rows[0];

      const bodyText = received.text || htmlToText(received.html || "");
      const payload = {
        subject: received.subject || "(no subject)",
        message: bodyText || "",
        direction: "inbound",
        source: "resend",
        from: received.from || "",
        to: received.to || [],
        cc: received.cc || [],
        bcc: received.bcc || [],
        reply_to: received.reply_to || [],
        headers: received.headers || {},
        resend_email_id: received.id,
        raw: received.raw || null
      };
      const enc = hybridEncryptNode(user.rsa_public_key_pem, payload);
      const inserted = await query(
        `insert into messages(user_id, from_name, from_email, key_version, encrypted_key_b64, iv_b64, ciphertext_b64)
         values($1,$2,$3,$4,$5,$6,$7)
         returning id`,
        [user.id, received.from || null, extractAddress(received.from || "") || null, user.version, enc.encrypted_key_b64, enc.iv_b64, enc.ciphertext_b64]
      );
      const messageId = inserted.rows[0].id;

      const attachments = Array.isArray(received.attachments) ? received.attachments : [];
      for(const attachment of attachments){
        try{
          const attMeta = await resendGet(`/emails/receiving/${encodeURIComponent(received.id)}/attachments/${encodeURIComponent(attachment.id)}`);
          if(!attMeta || !attMeta.download_url) continue;
          const fileRes = await fetch(attMeta.download_url);
          if(!fileRes.ok) continue;
          const buf = Buffer.from(await fileRes.arrayBuffer());
          const encAtt = hybridEncryptBytesNode(user.rsa_public_key_pem, buf);
          await query(
            `insert into attachments(message_id, filename, mime_type, size_bytes, encrypted_key_b64, iv_b64, ciphertext)
             values($1,$2,$3,$4,$5,$6,$7)`,
            [messageId, attMeta.filename || attachment.filename || 'attachment', attMeta.content_type || attachment.content_type || 'application/octet-stream', Number(attMeta.size || buf.length || 0), encAtt.encrypted_key_b64, encAtt.iv_b64, encAtt.ciphertext]
          );
        }catch(e){
          // Do not fail the whole inbound email if one attachment fetch/storage fails.
        }
      }

      created.push({ handle: user.handle, message_id: messageId });
    }

    return json(200, { ok: true, created });
  }catch(err){
    const status = err.statusCode || 500;
    return json(status, { error: err.message || "Server error" });
  }
};
