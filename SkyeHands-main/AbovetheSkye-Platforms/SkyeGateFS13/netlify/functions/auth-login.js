import { wrap } from "./_lib/wrap.js";
import { buildCors, json, badRequest, getClientIp, getUserAgent } from "./_lib/http.js";
import { audit } from "./_lib/audit.js";
import { getUserByEmail, getUserPasswordRecord, updateUserLastSeen } from "./_lib/identity.js";
import { ensureSystemClient, issueRefreshToken } from "./_lib/oauth.js";
import { verifyPassword } from "./_lib/passwords.js";
import { buildAuthMeResponse, createSession, touchSession } from "./_lib/sessions.js";

export default wrap(async (req) => {
  const cors = buildCors(req);
  const issuer = new URL(req.url).origin;
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" }, cors);

  let body;
  try { body = await req.json(); } catch { return badRequest("Invalid JSON", cors); }

  const email = (body.email || "").toString().trim();
  const password = (body.password || "").toString();
  if (!email) return badRequest("Missing email", cors);
  if (!password) return badRequest("Missing password", cors);

  const user = await getUserByEmail(email);
  if (!user || !user.is_active) {
    await audit("auth", "AUTH_LOGIN_FAIL", null, { email });
    return json(401, { error: "Invalid credentials" }, cors);
  }

  const passwordRecord = await getUserPasswordRecord(user.id);
  const ok = passwordRecord ? await verifyPassword(password, passwordRecord.password_hash) : false;
  if (!ok) {
    await audit("auth", "AUTH_LOGIN_FAIL", `user:${user.id}`, { email });
    return json(401, { error: "Invalid credentials" }, cors);
  }

  const session = await createSession({
    user,
    customerId: user.primary_customer_id,
    scope: ["openid", "profile", "email", "offline_access", "gateway.read", "keys.read", "billing.read"],
    title: "SkyeGateFS13 primary session",
    meta: { flow: "login" },
    issuer
  });
  await touchSession(session.session_id, { ip: getClientIp(req), userAgent: getUserAgent(req) });
  const client = await ensureSystemClient();
  const refresh = await issueRefreshToken({
    userId: user.id,
    clientId: client.client_id,
    sessionId: session.session_id,
    scope: session.scope,
    audience: "skygatefs13",
    metadata: { flow: "login" }
  });

  await updateUserLastSeen(user.id);
  await audit("auth", "AUTH_LOGIN_OK", `user:${user.id}`, { email: user.email });

  return json(200, {
    user: buildAuthMeResponse({ user, session: { id: session.session_id, session_kind: "human", customer_id: user.primary_customer_id, api_key_id: null, scope: session.scope, expires_at: session.expires_at, created_at: new Date().toISOString() }, claims: session.claims }),
    session: {
      token: session.token,
      expires_at: session.expires_at,
      session_id: session.session_id
    },
    refresh_token: refresh.token
  }, cors);
});
