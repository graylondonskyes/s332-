import { wrap } from "./_lib/wrap.js";
import { buildCors, json } from "./_lib/http.js";
import { requireAdmin } from "./_lib/admin.js";
import { getRepoEnvSections, getRepoEnvSummary } from "./_lib/repoEnvCatalog.js";

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });

  const admin = requireAdmin(req);
  if (!admin) return json(401, { error: "Unauthorized" }, cors);

  if (req.method !== "GET") return json(405, { error: "Method not allowed" }, cors);

  return json(200, {
    ok: true,
    canonical_template: "env.ultimate.template",
    summary: getRepoEnvSummary(),
    sections: getRepoEnvSections()
  }, cors);
});
