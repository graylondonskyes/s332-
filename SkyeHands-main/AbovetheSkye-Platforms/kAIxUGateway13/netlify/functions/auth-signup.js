import { wrap } from "./_lib/wrap.js";
import { buildCors, json, badRequest } from "./_lib/http.js";
import { audit } from "./_lib/audit.js";
import { createVerificationToken, sendVerificationEmail } from "./_lib/emailAuth.js";
import { createUser, ensureCustomerForUser, getUserByEmail } from "./_lib/identity.js";
import { ensureSystemClient, issueRefreshToken } from "./_lib/oauth.js";
import { hashPassword } from "./_lib/passwords.js";
import { createSession } from "./_lib/sessions.js";

export default wrap(async (req) => {
  const cors = buildCors(req);
  const issuer = new URL(req.url).origin;
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" }, cors);

  let body;
  try { body = await req.json(); } catch { return badRequest("Invalid JSON", cors); }

  const email = (body.email || "").toString().trim();
  const password = (body.password || "").toString();
  const displayName = (body.display_name || body.name || "").toString();
  if (!email) return badRequest("Missing email", cors);
  if (!password) return badRequest("Missing password", cors);

  const existing = await getUserByEmail(email);
  if (existing) return json(409, { error: "User already exists" }, cors);

  const customer = await ensureCustomerForUser({ email, planName: body.plan_name || "starter" });
  const passwordHash = await hashPassword(password);
  const user = await createUser({
    email,
    passwordHash,
    displayName,
    customerId: customer.id,
    role: "user",
    profile: body.profile || {}
  });
  const verificationToken = await createVerificationToken(user);
  const origin = new URL(req.url).origin;
  const emailDelivery = await sendVerificationEmail(user, verificationToken, origin);

  const client = await ensureSystemClient();
  const session = await createSession({
    user,
    customerId: customer.id,
    scope: ["openid", "profile", "email", "offline_access", "gateway.read", "keys.read", "billing.read"],
    title: "SkyeGateFS13 primary session",
    meta: { flow: "signup" },
    issuer
  });
  const refresh = await issueRefreshToken({
    userId: user.id,
    clientId: client.client_id,
    sessionId: session.session_id,
    scope: session.scope,
    audience: "skygatefs13",
    metadata: { flow: "signup" }
  });

  await audit("auth", "AUTH_SIGNUP", `user:${user.id}`, { email: user.email, customer_id: customer.id });

  return json(200, {
    issuer: origin,
    user: {
      id: user.id,
      email: user.email,
      display_name: user.display_name || null,
      primary_customer_id: customer.id,
      email_verified: false
    },
    session: {
      token: session.token,
      expires_at: session.expires_at,
      session_id: session.session_id
    },
    refresh_token: refresh.token,
    verification: {
      required: true,
      delivery: emailDelivery,
      token_preview: emailDelivery.mode === "preview" ? verificationToken : undefined
    }
  }, cors);
});
