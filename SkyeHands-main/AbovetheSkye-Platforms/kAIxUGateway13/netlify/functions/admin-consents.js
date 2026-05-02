import { wrap } from "./_lib/wrap.js";
import { buildCors, json, badRequest } from "./_lib/http.js";
import { resolveAdminAuthority } from "./_lib/admin.js";
import { audit } from "./_lib/audit.js";
import { listConsents, revokeConsent } from "./_lib/oauth.js";

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  const admin = await resolveAdminAuthority(req);
  if (!admin) return json(401, { error: "Unauthorized" }, cors);

  if (req.method === "GET") {
    return json(200, { consents: await listConsents() }, cors);
  }

  if (req.method === "DELETE") {
    const url = new URL(req.url);
    const id = url.searchParams.get("id") || "";
    if (!id) return badRequest("Missing id", cors);
    await revokeConsent(id);
    await audit("admin", "OAUTH_CONSENT_REVOKE", `consent:${id}`);
    return json(200, { ok: true }, cors);
  }

  return json(405, { error: "Method not allowed" }, cors);
});
