import crypto from "crypto";
import { q } from "./db.js";
import { hashOpaqueToken, randomOpaqueToken } from "./passwords.js";

function webhookUrl() {
  return (process.env.AUTH_EMAIL_WEBHOOK_URL || "").toString().trim();
}

async function sendEmail(kind, payload) {
  const url = webhookUrl();
  if (!url) return { delivered: false, mode: "preview" };
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind, ...payload })
  });
  return { delivered: res.ok, mode: "webhook", status: res.status };
}

async function createToken(tableName, user, ttlMinutes = 60) {
  const raw = randomOpaqueToken(32);
  const id = crypto.randomUUID();
  await q(
    `insert into ${tableName}(id, user_id, token_hash, email, expires_at)
     values ($1,$2,$3,$4, now() + ($5 * interval '1 minute'))`,
    [id, user.id, hashOpaqueToken(raw), user.email, parseInt(ttlMinutes, 10)]
  );
  return raw;
}

export async function createVerificationToken(user) {
  return await createToken("verification_tokens", user, 24 * 60);
}

export async function createResetToken(user) {
  return await createToken("reset_tokens", user, 60);
}

async function consumeToken(tableName, rawToken) {
  const res = await q(
    `update ${tableName}
     set used_at = coalesce(used_at, now())
     where token_hash=$1
       and used_at is null
       and expires_at > now()
     returning *`,
    [hashOpaqueToken(rawToken)]
  );
  return res.rowCount ? res.rows[0] : null;
}

export async function consumeVerificationToken(rawToken) {
  return await consumeToken("verification_tokens", rawToken);
}

export async function consumeResetToken(rawToken) {
  return await consumeToken("reset_tokens", rawToken);
}

export async function sendVerificationEmail(user, token, origin) {
  const verify_url = `${origin}/.netlify/functions/auth-verify-email?token=${encodeURIComponent(token)}`;
  return await sendEmail("verify_email", { to: user.email, verify_url, token_preview: token });
}

export async function sendResetEmail(user, token, origin) {
  const reset_url = `${origin}/.netlify/functions/auth-reset-password?token=${encodeURIComponent(token)}`;
  return await sendEmail("reset_password", { to: user.email, reset_url, token_preview: token });
}
