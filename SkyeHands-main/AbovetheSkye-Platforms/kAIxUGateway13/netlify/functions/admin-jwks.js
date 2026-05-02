import { wrap } from "./_lib/wrap.js";
import { buildCors, json } from "./_lib/http.js";
import { resolveAdminAuthority } from "./_lib/admin.js";
import { listSigningKeys } from "./_lib/jwks.js";

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  const admin = await resolveAdminAuthority(req);
  if (!admin) return json(401, { error: "Unauthorized" }, cors);
  if (req.method !== "GET") return json(405, { error: "Method not allowed" }, cors);
  return json(200, { keys: await listSigningKeys() }, cors);
});
