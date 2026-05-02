import { wrap } from "./_lib/wrap.js";
import { buildCors, json } from "./_lib/http.js";
import { resolveAdminAuthority } from "./_lib/admin.js";
import { audit } from "./_lib/audit.js";
import { rotateSigningKey } from "./_lib/jwks.js";

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  const admin = await resolveAdminAuthority(req);
  if (!admin) return json(401, { error: "Unauthorized" }, cors);
  if (req.method !== "POST") return json(405, { error: "Method not allowed" }, cors);
  const key = await rotateSigningKey({ retireExisting: true });
  await audit("admin", "OAUTH_JWKS_ROTATE", `kid:${key.kid}`);
  return json(200, { key: { kid: key.kid, activated_at: key.activated_at } }, cors);
});
