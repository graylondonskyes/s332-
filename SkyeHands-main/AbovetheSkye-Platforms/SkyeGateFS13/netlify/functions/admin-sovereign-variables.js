import { wrap } from "./_lib/wrap.js";
import { buildCors, json } from "./_lib/http.js";
import { requireAdmin } from "./_lib/admin.js";
import { deleteSovereignVariable, listSovereignVariables, upsertSovereignVariable } from "./_lib/sovereignVault.js";
import { audit } from "./_lib/audit.js";

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });

  const admin = requireAdmin(req);
  if (!admin) return json(401, { error: "Unauthorized" }, cors);

  if (req.method === "GET") {
    const url = new URL(req.url);
    const variables = await listSovereignVariables({
      scope_kind: url.searchParams.get("scope_kind") || "",
      scope_id: url.searchParams.get("scope_id") || "",
      vendor_key: url.searchParams.get("vendor_key") || ""
    });
    return json(200, { ok: true, variables }, cors);
  }

  if (req.method === "POST" || req.method === "PATCH") {
    const body = await req.json().catch(() => ({}));
    const variable = await upsertSovereignVariable(body || {});
    await audit(
      admin?.user_id ? `user:${admin.user_id}` : "admin",
      "SKYGATE_SOVEREIGN_VARIABLE_UPSERT",
      `sovereign-variable:${variable?.id || "unknown"}`,
      {
        via: admin?.via || "password",
        scope_kind: variable?.scope_kind || null,
        scope_id: variable?.scope_id || null,
        vendor_key: variable?.vendor_key || null,
        variable_name: variable?.variable_name || null,
        credential_mode: variable?.credential_mode || null,
        billing_mode: variable?.billing_mode || null
      }
    );
    return json(200, { ok: true, variable }, cors);
  }

  if (req.method === "DELETE") {
    const body = await req.json().catch(() => ({}));
    await deleteSovereignVariable(body?.id);
    await audit(
      admin?.user_id ? `user:${admin.user_id}` : "admin",
      "SKYGATE_SOVEREIGN_VARIABLE_DELETE",
      `sovereign-variable:${body?.id || "unknown"}`,
      { via: admin?.via || "password" }
    );
    return json(200, { ok: true }, cors);
  }

  return json(405, { error: "Method not allowed" }, cors);
});
