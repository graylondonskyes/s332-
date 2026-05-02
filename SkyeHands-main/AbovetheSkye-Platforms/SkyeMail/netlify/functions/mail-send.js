const { query } = require("./_db");
const { json, parseJson, verifyAuth, requireEnv, hybridEncryptNode } = require("./_utils");

function escapeHtml(s){
  return String(s || "").replace(/[<>&"]/g, c => ({ "<":"&lt;", ">":"&gt;", "&":"&amp;", '"':"&quot;" }[c]));
}

async function resendSend(payload){
  const key = requireEnv("RESEND_API_KEY");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  let data = null;
  try{ data = text ? JSON.parse(text) : null; }catch(e){ data = { raw: text }; }
  if(!res.ok){
    throw new Error((data && data.message) || (data && data.error) || text || `Resend send failed (${res.status})`);
  }
  return data;
}

exports.handler = async (event) => {
  try{
    if(event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });
    const auth = verifyAuth(event);
    const body = parseJson(event);
    const to = String(body.to || "").trim();
    const subject = String(body.subject || "").trim();
    const message = String(body.message || "");
    const replyTo = String(body.reply_to || "").trim();

    if(!to || !to.includes("@")) return json(400, { error: "Valid recipient email required." });
    if(!subject) return json(400, { error: "Subject required." });
    if(!message.trim()) return json(400, { error: "Message body required." });

    const userRes = await query(
      `select u.id, u.handle, u.email, uk.version, uk.rsa_public_key_pem
       from users u
       join user_keys uk on uk.user_id = u.id and uk.is_active = true
       where u.id = $1
       limit 1`,
      [auth.sub]
    );
    if(!userRes.rows.length) return json(401, { error: "Unauthorized" });
    const user = userRes.rows[0];

    const inboundDomain = requireEnv("INBOUND_DOMAIN");
    const fromEmail = `${user.handle}@${inboundDomain}`;
    const fromName = process.env.MAIL_FROM_FALLBACK_NAME ? `${process.env.MAIL_FROM_FALLBACK_NAME} • ${user.handle}` : user.handle;
    const html = `<div style="font-family:Arial,sans-serif;white-space:pre-wrap;line-height:1.6">${escapeHtml(message)}</div>`;

    const sendRes = await resendSend({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject,
      html,
      text: message,
      replyTo: replyTo || fromEmail
    });

    const enc = hybridEncryptNode(user.rsa_public_key_pem, {
      subject,
      message,
      direction: "sent",
      sent_via: "resend",
      from: fromEmail,
      to: [to],
      resend_id: sendRes && sendRes.id ? sendRes.id : null
    });

    const inserted = await query(
      `insert into messages(user_id, from_name, from_email, key_version, encrypted_key_b64, iv_b64, ciphertext_b64)
       values($1,$2,$3,$4,$5,$6,$7)
       returning id, created_at`,
      [user.id, `To: ${to}`, to, user.version, enc.encrypted_key_b64, enc.iv_b64, enc.ciphertext_b64]
    );

    return json(200, {
      ok: true,
      resend_id: sendRes && sendRes.id ? sendRes.id : null,
      message_id: inserted.rows[0].id,
      from: fromEmail,
      to
    });
  }catch(err){
    const status = err.statusCode || 500;
    return json(status, { error: err.message || "Server error" });
  }
};
