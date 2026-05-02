import { wrap } from "./_lib/wrap.js";
import { buildCors, json, getBearer } from "./_lib/http.js";
import { resolveAdminAuthority } from "./_lib/admin.js";
import { q } from "./_lib/db.js";
import { verifySessionToken } from "./_lib/sessions.js";

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  if (req.method !== "GET") return json(405, { error: "Method not allowed" }, cors);

  const admin = await resolveAdminAuthority(req);
  const session = admin ? null : await verifySessionToken(getBearer(req));
  if (!admin && !session?.user) return json(401, { error: "Unauthorized" }, cors);

  const url = new URL(req.url);
  const customerId = admin
    ? parseInt(url.searchParams.get("customer_id") || "0", 10) || null
    : session.user.primary_customer_id;
  if (!customerId) return json(400, { error: "Missing customer_id" }, cors);

  const res = await q(
    `select id, customer_id, key_last4, label, role, monthly_cap_cents, rpm_limit, rpd_limit, created_at, revoked_at
     from api_keys
     where customer_id=$1
     order by created_at desc`,
    [customerId]
  );
  return json(200, { keys: res.rows }, cors);
});
