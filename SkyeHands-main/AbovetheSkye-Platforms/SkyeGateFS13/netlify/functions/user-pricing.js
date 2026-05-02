import { wrap } from "./_lib/wrap.js";
import { buildCors, json, badRequest, getBearer, monthKeyUTC } from "./_lib/http.js";
import { resolveAuth, getMonthRollup, getKeyMonthRollup } from "./_lib/authz.js";
import { q } from "./_lib/db.js";
import { getPricingCatalog } from "./_lib/pricing.js";
import { getPushPricing } from "./_lib/pushCaps.js";

function normalizeList(value) {
  return Array.isArray(value) ? value.map((entry) => String(entry || "").trim()).filter(Boolean) : [];
}

function normalizeModelPolicy(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function selectProviderPolicy(keyRow) {
  const direct = normalizeList(keyRow?.allowed_providers);
  if (direct.length) return { source: "key", values: direct };
  const inherited = normalizeList(keyRow?.customer_allowed_providers);
  if (inherited.length) return { source: "customer", values: inherited };
  return { source: "open", values: [] };
}

function selectModelPolicy(keyRow) {
  const direct = normalizeModelPolicy(keyRow?.allowed_models);
  if (direct && Object.keys(direct).length) return { source: "key", values: direct };
  const inherited = normalizeModelPolicy(keyRow?.customer_allowed_models);
  if (inherited && Object.keys(inherited).length) return { source: "customer", values: inherited };
  return { source: "open", values: null };
}

function isProviderAllowed(policy, provider) {
  if (!policy || policy.source === "open") return true;
  return policy.values.includes(provider);
}

function isModelAllowed(policy, provider, model) {
  if (!policy || policy.source === "open" || !policy.values) return true;
  const raw = policy.values?.[provider];
  if (!raw) return false;
  if (raw === "*") return true;
  const values = normalizeList(raw);
  return values.includes("*") || values.includes(model);
}

function monthRangeUTC(month) {
  const [y, m] = String(month || "").split("-").map((x) => parseInt(x, 10));
  if (!y || !m || m < 1 || m > 12) return null;
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0));
  return { start, end };
}

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  if (req.method !== "GET") return json(405, { error: "Method not allowed" }, cors);

  const token = getBearer(req);
  if (!token) return json(401, { error: "Missing Authorization: Bearer <virtual_key>" }, cors);

  const keyRow = await resolveAuth(token);
  if (!keyRow) return json(401, { error: "Invalid or revoked key" }, cors);
  if (!keyRow.is_active) return json(403, { error: "Customer disabled" }, cors);

  const url = new URL(req.url);
  const month = (url.searchParams.get("month") || monthKeyUTC()).toString().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) return badRequest("Invalid month format. Use YYYY-MM.", cors);

  const providerPolicy = selectProviderPolicy(keyRow);
  const modelPolicy = selectModelPolicy(keyRow);
  const pricing = getPricingCatalog();

  const usageAgg = await q(
    `select provider,
            model,
            count(*)::int as calls,
            coalesce(sum(cost_cents),0)::int as cost_cents,
            coalesce(sum(input_tokens),0)::int as input_tokens,
            coalesce(sum(output_tokens),0)::int as output_tokens
     from usage_events
     where api_key_id=$1 and to_char(created_at at time zone 'UTC','YYYY-MM')=$2
     group by provider, model
     order by provider asc, model asc`,
    [keyRow.api_key_id, month]
  );

  const usageMap = new Map();
  for (const row of usageAgg.rows) {
    usageMap.set(`${row.provider}::${row.model}`, row);
  }

  const providers = Object.entries(pricing || {}).flatMap(([provider, models]) => {
    return Object.entries(models || {}).map(([model, entry]) => {
      const usage = usageMap.get(`${provider}::${model}`) || null;
      return {
        provider,
        model,
        input_per_1m_usd: Number(entry?.input_per_1m_usd || 0),
        output_per_1m_usd: Number(entry?.output_per_1m_usd || 0),
        input_per_1k_usd: Number(entry?.input_per_1m_usd || 0) / 1000,
        output_per_1k_usd: Number(entry?.output_per_1m_usd || 0) / 1000,
        allowed: isProviderAllowed(providerPolicy, provider) && isModelAllowed(modelPolicy, provider, model),
        policy_source: modelPolicy.source !== "open" || providerPolicy.source !== "open"
          ? (modelPolicy.source !== "open" ? modelPolicy.source : providerPolicy.source)
          : "open",
        used_this_month: !!usage,
        used_this_month_calls: usage?.calls || 0,
        used_this_month_cost_cents: usage?.cost_cents || 0,
        used_this_month_input_tokens: usage?.input_tokens || 0,
        used_this_month_output_tokens: usage?.output_tokens || 0
      };
    });
  });

  const customerMonth = await getMonthRollup(keyRow.customer_id, month);
  const keyMonth = await getKeyMonthRollup(keyRow.api_key_id, month);

  const pushCfg = await getPushPricing(keyRow.customer_id);
  const range = monthRangeUTC(month);
  let push = null;
  if (pushCfg && range) {
    const pushUsage = await q(
      `select
          count(*) filter (where event_type='deploy_ready')::int as deploys_ready,
          coalesce(sum(bytes) filter (where event_type='file_upload'),0)::bigint as bytes_uploaded
       from push_usage_events
       where customer_id=$1 and created_at >= $2 and created_at < $3`,
      [keyRow.customer_id, range.start.toISOString(), range.end.toISOString()]
    );
    const deploys_ready = Number(pushUsage.rows[0]?.deploys_ready || 0);
    const bytes_uploaded = Number(pushUsage.rows[0]?.bytes_uploaded || 0);
    const gb_estimate = bytes_uploaded / 1073741824;
    const base_month_cents = Number(pushCfg.base_month_cents || 0);
    const deploy_cost_cents = Number(pushCfg.per_deploy_cents || 0) * deploys_ready;
    const storage_cost_cents = Math.round(Number(pushCfg.per_gb_cents || 0) * gb_estimate);
    push = {
      pricing_version: pushCfg.pricing_version,
      currency: pushCfg.currency,
      monthly_cap_cents: Number(pushCfg.monthly_cap_cents || 0),
      base_month_cents,
      per_deploy_cents: Number(pushCfg.per_deploy_cents || 0),
      per_gb_cents: Number(pushCfg.per_gb_cents || 0),
      deploys_ready,
      bytes_uploaded,
      gb_estimate: Math.round(gb_estimate * 1000) / 1000,
      projected_total_cents: base_month_cents + deploy_cost_cents + storage_cost_cents
    };
  }

  return json(200, {
    pricing_source: "pricing/pricing.json",
    month,
    customer: {
      id: keyRow.customer_id,
      plan_name: keyRow.customer_plan_name || "",
      email: keyRow.customer_email || null
    },
    key: {
      id: keyRow.api_key_id,
      label: keyRow.label || null,
      key_last4: keyRow.key_last4 || null,
      role: keyRow.role || "deployer"
    },
    access_policy: {
      providers: providerPolicy,
      models: {
        source: modelPolicy.source,
        values: modelPolicy.values
      }
    },
    month_rollup: {
      customer_spent_cents: Number(customerMonth.spent_cents || 0),
      customer_input_tokens: Number(customerMonth.input_tokens || 0),
      customer_output_tokens: Number(customerMonth.output_tokens || 0),
      key_spent_cents: Number(keyMonth.spent_cents || 0),
      key_calls: Number(keyMonth.calls || 0),
      key_input_tokens: Number(keyMonth.input_tokens || 0),
      key_output_tokens: Number(keyMonth.output_tokens || 0)
    },
    ai_pricing: providers,
    push_pricing: push
  }, cors);
});
