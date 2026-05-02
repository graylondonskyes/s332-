import crypto from "crypto";
import { q } from "./db.js";
import { getUserById } from "./identity.js";
import { issueSignedJwt, issuerUrl, verifySignedJwt } from "./jwks.js";

function toExpiry(ttlSeconds) {
  return new Date(Date.now() + (ttlSeconds * 1000)).toISOString();
}

function parseScopes(scopeInput) {
  if (!scopeInput) return [];
  if (Array.isArray(scopeInput)) return scopeInput.map(String).map((v) => v.trim()).filter(Boolean);
  return String(scopeInput).split(/\s+/).map((v) => v.trim()).filter(Boolean);
}

export async function createSession({
  user = null,
  customerId = null,
  apiKeyId = null,
  sessionKind = "human",
  scope = [],
  ttlSeconds = parseInt(process.env.USER_SESSION_TTL_SECONDS || "21600", 10),
  title = null,
  meta = {},
  issuer = null
}) {
  const sessionId = crypto.randomUUID();
  const expiresAt = toExpiry(ttlSeconds);
  const scopes = parseScopes(scope);
  await q(
    `insert into user_sessions(id, user_id, customer_id, api_key_id, session_kind, token_family, title, scope, meta, expires_at)
     values ($1,$2,$3,$4,$5,'session',$6,$7,$8::jsonb,$9)`,
    [sessionId, user?.id || null, customerId ?? user?.primary_customer_id ?? null, apiKeyId, sessionKind, title, scopes, JSON.stringify(meta || {}), expiresAt]
  );
  const { token, claims } = await issueSignedJwt({
    sub_type: user ? "user" : "bridge",
    type: "user_session",
    sid: sessionId,
    scope: scopes,
    customer_id: customerId ?? user?.primary_customer_id ?? null,
    api_key_id: apiKeyId ?? null,
    role: user?.role || "bridge",
    email: user?.email || null,
    email_verified: !!user?.email_verified_at
  }, {
    ttlSeconds,
    subject: user?.id || `bridge:${sessionId}`,
    audience: "skygatefs13",
    issuer
  });
  return { session_id: sessionId, token, claims, expires_at: expiresAt, scope: scopes };
}

export async function revokeSession(sessionId, reason = "logout") {
  if (!sessionId) return;
  await q(
    `update user_sessions
     set revoked_at = coalesce(revoked_at, now()),
         revocation_reason = coalesce(revocation_reason, $2)
     where id=$1`,
    [sessionId, reason]
  );
}

export async function revokeAllUserSessions(userId, reason = "global_logout") {
  await q(
    `update user_sessions
     set revoked_at = coalesce(revoked_at, now()),
         revocation_reason = coalesce(revocation_reason, $2)
     where user_id=$1 and revoked_at is null`,
    [userId, reason]
  );
}

export async function getSessionById(sessionId) {
  const res = await q(`select * from user_sessions where id=$1 limit 1`, [sessionId]);
  return res.rowCount ? res.rows[0] : null;
}

export async function touchSession(sessionId, { ip = null, userAgent = null } = {}) {
  await q(
    `update user_sessions
     set last_seen_at = now(),
         last_seen_ip = coalesce($2, last_seen_ip),
         last_seen_user_agent = coalesce($3, last_seen_user_agent)
     where id=$1`,
    [sessionId, ip, userAgent]
  );
}

export async function verifySessionToken(token) {
  const verified = await verifySignedJwt(token, { expectedAudience: "skygatefs13" });
  if (!verified) return null;
  if (verified.payload.type !== "user_session") return null;
  const session = await getSessionById(verified.payload.sid);
  if (!session || session.revoked_at) return null;
  if (new Date(session.expires_at).getTime() <= Date.now()) return null;
  const user = session.user_id ? await getUserById(session.user_id) : null;
  if (session.user_id && (!user || !user.is_active)) return null;
  return { ...verified, session, user };
}

export function buildAuthMeResponse({ user, session, claims }) {
  const subjectType = user ? "user" : (claims?.sub_type || "bridge");
  const subjectId = user?.id || claims?.sub || null;
  const subjectRole = user?.role || claims?.role || (user ? "user" : "bridge");
  return {
    issuer: claims?.iss || issuerUrl(),
    subject: {
      type: subjectType,
      id: subjectId,
      email: user?.email || claims?.email || null,
      display_name: user?.display_name || null,
      role: subjectRole,
      email_verified: !!(user?.email_verified_at || claims?.email_verified)
    },
    session: session ? {
      id: session.id,
      kind: session.session_kind,
      customer_id: session.customer_id,
      api_key_id: session.api_key_id,
      scope: session.scope || [],
      expires_at: session.expires_at,
      created_at: session.created_at,
      revoked_at: session.revoked_at || null
    } : null,
    claims
  };
}
