import { wrap } from "./_lib/wrap.js";
import { buildCors, json, getBearer } from "./_lib/http.js";
import { revokeRefreshToken } from "./_lib/oauth.js";
import { revokeSession, verifySessionToken } from "./_lib/sessions.js";

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" }, cors);

  const token = getBearer(req);
  if (token) {
    const session = await verifySessionToken(token);
    if (session?.session?.id) await revokeSession(session.session.id, "oauth_logout");
  }

  let body = {};
  try { body = await req.json(); } catch {}
  if (body.refresh_token) await revokeRefreshToken(body.refresh_token);

  return json(200, { ok: true, post_logout_redirect_uri: body.post_logout_redirect_uri || null }, cors);
});
