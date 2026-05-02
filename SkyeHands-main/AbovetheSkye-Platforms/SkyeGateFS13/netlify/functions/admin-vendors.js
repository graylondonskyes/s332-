import { wrap } from "./_lib/wrap.js";
import { buildCors, json } from "./_lib/http.js";
import { requireAdmin } from "./_lib/admin.js";
import { listVendorRegistry, upsertVendorRegistry } from "./_lib/sovereignVault.js";
import { vendorSummary } from "./_lib/vendorRegistry.js";
import { getRepoEnvSummary } from "./_lib/repoEnvCatalog.js";
import { audit } from "./_lib/audit.js";

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });

  const admin = requireAdmin(req);
  if (!admin) return json(401, { error: "Unauthorized" }, cors);

  if (req.method === "GET") {
    const vendors = await listVendorRegistry();
    return json(200, { ok: true, summary: vendorSummary(), repo_env: getRepoEnvSummary(), vendors }, cors);
  }

  if (req.method === "POST" || req.method === "PATCH") {
    const body = await req.json().catch(() => ({}));
    const vendor = await upsertVendorRegistry(body || {});
    await audit(
      admin?.user_id ? `user:${admin.user_id}` : "admin",
      "SKYGATE_VENDOR_UPSERT",
      `vendor:${vendor?.vendor_key || body?.vendor_key || "unknown"}`,
      {
        via: admin?.via || "password",
        ops_status: vendor?.ops_status || null,
        preferred_credential_mode: vendor?.preferred_credential_mode || null
      }
    );
    return json(200, { ok: true, vendor }, cors);
  }

  return json(405, { error: "Method not allowed" }, cors);
});
