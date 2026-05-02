import { wrap } from "./_lib/wrap.js";
import { buildCors, json, monthKeyUTC } from "./_lib/http.js";
import { requireAdmin } from "./_lib/admin.js";
import { q } from "./_lib/db.js";
import { getPricingCatalog } from "./_lib/pricing.js";

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });

  const admin = requireAdmin(req);
  if (!admin) return json(401, { error: "Unauthorized" }, cors);
  if (req.method !== "GET") return json(405, { error: "Method not allowed" }, cors);

  const url = new URL(req.url);
  const month = (url.searchParams.get("month") || monthKeyUTC()).toString().slice(0, 7);
  const pricing = getPricingCatalog();

  const usage = await q(
    `select provider,
            model,
            count(*)::int as calls,
            coalesce(sum(cost_cents),0)::int as cost_cents,
            coalesce(sum(input_tokens),0)::int as input_tokens,
            coalesce(sum(output_tokens),0)::int as output_tokens
     from usage_events
     where to_char(created_at at time zone 'UTC','YYYY-MM')=$1
     group by provider, model
     order by cost_cents desc, calls desc`,
    [month]
  );

  const usageMap = new Map();
  for (const row of usage.rows) {
    usageMap.set(`${row.provider}::${row.model}`, row);
  }

  const catalog = [];
  for (const [provider, models] of Object.entries(pricing || {})) {
    for (const [model, entry] of Object.entries(models || {})) {
      const key = `${provider}::${model}`;
      const used = usageMap.get(key) || null;
      catalog.push({
        provider,
        model,
        input_per_1m_usd: Number(entry?.input_per_1m_usd || 0),
        output_per_1m_usd: Number(entry?.output_per_1m_usd || 0),
        used_this_month: !!used,
        calls_this_month: used?.calls || 0,
        cost_cents_this_month: used?.cost_cents || 0,
        input_tokens_this_month: used?.input_tokens || 0,
        output_tokens_this_month: used?.output_tokens || 0
      });
    }
  }

  const unpricedUsage = usage.rows.filter((row) => !(pricing?.[row.provider]?.[row.model]));

  return json(200, {
    pricing_source: "pricing/pricing.json",
    month,
    summary: {
      provider_count: Object.keys(pricing || {}).length,
      model_count: catalog.length,
      used_catalog_models_this_month: catalog.filter((row) => row.used_this_month).length,
      unpriced_usage_rows: unpricedUsage.length
    },
    catalog,
    unpriced_usage: unpricedUsage
  }, cors);
});
