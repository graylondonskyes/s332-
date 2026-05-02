import { wrap } from "./_lib/wrap.js";
import { buildCors, json, monthKeyUTC } from "./_lib/http.js";
import { requireAdmin } from "./_lib/admin.js";
import { q } from "./_lib/db.js";

function chooseBrainProvider() {
  if (String(process.env.OPENAI_API_KEY || "").trim()) return "openai";
  if (String(process.env.ANTHROPIC_API_KEY || "").trim()) return "anthropic";
  if (String(process.env.GEMINI_API_KEY || "").trim()) return "gemini";
  return null;
}

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  const admin = requireAdmin(req);
  if (!admin) return json(401, { error: "Unauthorized" }, cors);
  if (req.method !== "GET") return json(405, { error: "Method not allowed" }, cors);

  const url = new URL(req.url);
  const month = (url.searchParams.get("month") || monthKeyUTC()).toString().slice(0, 7);

  const [customers, keys, usage, topups, leaders, recent] = await Promise.all([
    q(`select count(*)::int as total, count(*) filter (where is_active=true)::int as active from customers`, []),
    q(`select count(*)::int as total, count(*) filter (where revoked_at is null)::int as active from api_keys`, []),
    q(`select coalesce(sum(spent_cents),0)::int as spent_cents from monthly_usage where month=$1`, [month]),
    q(`select coalesce(sum(amount_cents),0)::int as amount_cents from topup_events where month=$1`, [month]),
    q(
      `select c.email, c.plan_name,
              coalesce(m.spent_cents,0)::int as spent_cents,
              coalesce(m.extra_cents,0)::int as extra_cents,
              (coalesce(m.input_tokens,0) + coalesce(m.output_tokens,0))::bigint as token_volume
       from customers c
       left join monthly_usage m on m.customer_id=c.id and m.month=$1
       order by spent_cents desc, token_volume desc
       limit 10`,
      [month]
    ),
    q(
      `select c.email, e.provider, e.model, e.cost_cents, e.created_at
       from usage_events e
       join customers c on c.id = e.customer_id
       where to_char(e.created_at at time zone 'UTC','YYYY-MM')=$1
       order by e.created_at desc
       limit 20`,
      [month]
    )
  ]);

  const provider = chooseBrainProvider();
  const brainUrl = String(process.env.SKYEFUEL_STATION_BRAIN_URL || "").trim();

  return json(200, {
    overview: {
      month,
      customers: customers.rows?.[0] || { total: 0, active: 0 },
      keys: keys.rows?.[0] || { total: 0, active: 0 },
      treasury: {
        spent_cents: Number(usage.rows?.[0]?.spent_cents || 0),
        topup_cents: Number(topups.rows?.[0]?.amount_cents || 0)
      }
    },
    station: {
      pricing: {
        service_asset_name: "SkyeTokens",
        bonus_return_pct: 31,
        discount_pct: 0
      },
      assets: [
        { name: "SkyeTokens", role: "service-asset", description: "House service units redeemed across shared gate lanes." },
        { name: "House LLM Lane", role: "platform-shared", description: "Gate-owned AI vendor routing for metered development and production use." },
        { name: "Sovereign Vault BYO", role: "customer-byo", description: "Customer-supplied vendor credentials routed through the gate for clearance and tracking." }
      ]
    },
    preview: {
      base_usd: 100,
      effective_service_units: 131
    },
    brain_gate: {
      configured: !!brainUrl || !!provider,
      connected: false,
      provider,
      model: String(process.env.SKYGATEFS13_GATE_MODEL || process.env.SKYGATE_GATE_MODEL || "kaixu/deep").trim(),
      url: brainUrl || null,
      endpoint: brainUrl ? "/status" : null,
      locked: !!provider,
      error: brainUrl ? "Configured station brain was not probed in local admin mode." : null
    },
    leaders: leaders.rows || [],
    recent_events: recent.rows || []
  }, cors);
});
