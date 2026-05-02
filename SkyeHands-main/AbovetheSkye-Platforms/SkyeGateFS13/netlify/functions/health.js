import { wrap } from "./_lib/wrap.js";
import { json, buildCors } from "./_lib/http.js";
import { q } from "./_lib/db.js";
import { BUILD_ID, SCHEMA_VERSION, KAIXU_SYSTEM_HASH } from "./_lib/kaixu.js";
import { getVendorCatalog, vendorSummary } from "./_lib/vendorRegistry.js";

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });

  const vendors = getVendorCatalog();

  const out = {
    ok: true,
    ts: new Date().toISOString(),
    build: { id: BUILD_ID, schema: SCHEMA_VERSION, kaixu_system_hash: KAIXU_SYSTEM_HASH },
    env: {
      hasDbUrl: !!(process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL),
      hasJwtSecret: !!process.env.JWT_SECRET,
      hasAdminPassword: !!process.env.ADMIN_PASSWORD,
      hasPlatformMirrorSecret: !!(process.env.SKYGATE_EVENT_MIRROR_SECRET || process.env.SKYGATEFS13_EVENT_MIRROR_SECRET),
      providers: {
        openai: !!process.env.OPENAI_API_KEY,
        anthropic: !!process.env.ANTHROPIC_API_KEY,
        gemini: !!process.env.GEMINI_API_KEY
      },
      vendors: {
        summary: vendorSummary(),
        entries: vendors.map((vendor) => ({
          key: vendor.key,
          category: vendor.category,
          configured: vendor.configured,
          env_status: vendor.env_status
        }))
      }
    },
    db: { ok: false }
  };

  try {
    const r = await q("select now() as now");
    out.db = { ok: true, now: r.rows?.[0]?.now || null };
  } catch (e) {
    out.db = { ok: false, error: e?.message || String(e), code: e?.code || undefined, hint: e?.hint || undefined };
  }

  return json(200, out, cors);
});
