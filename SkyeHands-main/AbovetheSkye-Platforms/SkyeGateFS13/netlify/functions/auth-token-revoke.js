import { wrap } from "./_lib/wrap.js";
import { buildCors, json, badRequest, getBearer } from "./_lib/http.js";
import { resolveAdminAuthority } from "./_lib/admin.js";
import { audit } from "./_lib/audit.js";
import { q } from "./_lib/db.js";
import { verifySessionToken } from "./_lib/sessions.js";

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" }, cors);

  const admin = await resolveAdminAuthority(req);
  const session = admin ? null : await verifySessionToken(getBearer(req));
  if (!admin && !session?.user) return json(401, { error: "Unauthorized" }, cors);

  let body;
  try { body = await req.json(); } catch { return badRequest("Invalid JSON", cors); }
  const keyId = parseInt(body.key_id, 10);
  if (!keyId) return badRequest("Missing key_id", cors);
  await q(`update api_keys set revoked_at=coalesce(revoked_at, now()) where id=$1`, [keyId]);
  await audit("auth", "AUTH_TOKEN_REVOKE", `key:${keyId}`, { actor_user_id: session?.user?.id || null });
  return json(200, { ok: true }, cors);
});
