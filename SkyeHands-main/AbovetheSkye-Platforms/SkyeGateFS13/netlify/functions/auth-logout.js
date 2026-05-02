import { wrap } from "./_lib/wrap.js";
import { buildCors, json, getBearer } from "./_lib/http.js";
import { audit } from "./_lib/audit.js";
import { revokeRefreshToken } from "./_lib/oauth.js";
import { revokeSession, verifySessionToken } from "./_lib/sessions.js";

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" }, cors);

  const bearer = getBearer(req);
  if (bearer) {
    const verified = await verifySessionToken(bearer);
    if (verified?.session?.id) {
      await revokeSession(verified.session.id, "logout");
      await audit("auth", "AUTH_LOGOUT", `session:${verified.session.id}`, { user_id: verified.user?.id || null });
    }
  }

  let body = {};
  try { body = await req.json(); } catch {}
  if (body.refresh_token) {
    await revokeRefreshToken(body.refresh_token);
  }

  return json(200, { ok: true }, cors);
});
