import { wrap } from "./_lib/wrap.js";
import { buildCors, json, getBearer } from "./_lib/http.js";
import { buildAuthMeResponse, verifySessionToken } from "./_lib/sessions.js";
import { verifyAccessToken } from "./_lib/oauth.js";
import { getUserById } from "./_lib/identity.js";

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  if (req.method !== "GET") return json(405, { error: "Method not allowed" }, cors);

  const token = getBearer(req);
  if (!token) return json(401, { error: "Missing bearer token" }, cors);

  const session = await verifySessionToken(token);
  if (session) {
    return json(200, buildAuthMeResponse({ user: session.user, session: session.session, claims: session.payload }), cors);
  }

  const access = await verifyAccessToken(token);
  if (!access) return json(401, { error: "Invalid token" }, cors);
  const user = access.payload.sub ? await getUserById(access.payload.sub) : null;
  return json(200, {
    issuer: access.payload.iss,
    subject: {
      type: access.payload.sub_type || "user",
      id: access.payload.sub,
      email: user?.email || access.payload.email || null,
      display_name: user?.display_name || null,
      role: user?.role || access.payload.role || null
    },
    session: access.payload.sid ? { id: access.payload.sid } : null,
    claims: access.payload
  }, cors);
});
