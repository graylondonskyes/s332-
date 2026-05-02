import { wrap } from "./_lib/wrap.js";
import { buildCors, json } from "./_lib/http.js";
import { requireAdmin } from "./_lib/admin.js";
import { q } from "./_lib/db.js";

function text(value, max = 4000) {
  return String(value || "").trim().slice(0, max);
}

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  const admin = requireAdmin(req);
  if (!admin) return json(401, { error: "Unauthorized" }, cors);
  if (req.method !== "PUT") return json(405, { error: "Method not allowed" }, cors);

  const body = await req.json().catch(() => ({}));
  const app_id = text(body?.app_id, 120);
  if (!app_id) return json(400, { error: "Missing app_id" }, cors);

  const health_status = text(body?.health_status, 40) || "unreviewed";
  const onboarding_stage = text(body?.onboarding_stage, 40) || "untracked";
  const lifecycle_status = text(body?.lifecycle_status, 40) || "active";
  const owner = text(body?.owner, 200) || null;
  const notes = text(body?.notes, 4000) || null;

  await q(
    `insert into platform_operator_state(app_id, health_status, onboarding_stage, lifecycle_status, owner, notes, last_checked_at, updated_at)
     values ($1,$2,$3,$4,$5,$6,now(),now())
     on conflict (app_id)
     do update set
       health_status=excluded.health_status,
       onboarding_stage=excluded.onboarding_stage,
       lifecycle_status=excluded.lifecycle_status,
       owner=excluded.owner,
       notes=excluded.notes,
       last_checked_at=excluded.last_checked_at,
       updated_at=now()`,
    [app_id, health_status, onboarding_stage, lifecycle_status, owner, notes]
  );

  return json(200, { ok: true, app_id }, cors);
});
