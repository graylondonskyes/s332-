import { wrap } from "./_lib/wrap.js";
import { buildCors, json, badRequest, getBearer } from "./_lib/http.js";
import { resolveAdminAuthority } from "./_lib/admin.js";
import { audit } from "./_lib/audit.js";
import { q } from "./_lib/db.js";
import { randomKey, keyHashHex, encryptSecret } from "./_lib/crypto.js";
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
  const customerId = Number.isFinite(body.customer_id) ? parseInt(body.customer_id, 10) : session?.user?.primary_customer_id;
  if (!customerId) return badRequest("Missing customer_id", cors);

  const key = randomKey("kx_live_");
  const keyHash = keyHashHex(key);
  const keyLast4 = key.slice(-4);
  const label = (body.label || "app-token").toString().slice(0, 60);
  const role = (body.role || "deployer").toString().slice(0, 32);
  const res = await q(
    `insert into api_keys(customer_id, key_hash, key_last4, label, role, monthly_cap_cents, rpm_limit, encrypted_key)
     values ($1,$2,$3,$4,$5,$6,$7,$8)
     returning id, created_at`,
    [customerId, keyHash, keyLast4, label, role, body.monthly_cap_cents ?? null, body.rpm_limit ?? null, encryptSecret(key)]
  );
  await audit("auth", "AUTH_TOKEN_ISSUE", `key:${res.rows[0].id}`, { customer_id: customerId, actor_user_id: session?.user?.id || null });
  return json(200, {
    api_key: {
      id: res.rows[0].id,
      key,
      key_last4: keyLast4,
      label,
      created_at: res.rows[0].created_at
    }
  }, cors);
});
