import { encryptSecret } from "./crypto.js";
import { q } from "./db.js";
import { getVendorCatalog, getVendorCatalogMap } from "./vendorRegistry.js";

const VENDOR_MAP = getVendorCatalogMap();

function normalizeText(value, max = 160) {
  return String(value || "").trim().slice(0, max);
}

function normalizeNullableText(value, max = 160) {
  const out = normalizeText(value, max);
  return out || null;
}

function parseScopeKind(input) {
  const value = normalizeText(input, 32).toLowerCase();
  if (["global", "customer", "user", "app", "workspace"].includes(value)) return value;
  return "global";
}

function parseJsonObject(input, fallback = {}) {
  if (input && typeof input === "object" && !Array.isArray(input)) return input;
  return fallback;
}

function secretLast4(secret) {
  const trimmed = String(secret || "").trim();
  if (!trimmed) return "";
  return trimmed.slice(-4);
}

export async function listVendorRegistry() {
  const rows = await q(
    `select vendor_key, display_name, category, ops_status, preferred_credential_mode, notes, metadata, updated_at
       from vendor_registry
      order by vendor_key asc`
  );

  const registry = new Map();
  for (const row of rows.rows || []) {
    registry.set(row.vendor_key, row);
  }

  const linkedCounts = await q(
    `select vendor_key,
            count(*)::int as total_variables,
            count(*) filter (where credential_mode = 'platform-shared')::int as shared_variables,
            count(*) filter (where credential_mode = 'customer-owned')::int as customer_variables,
            count(*) filter (where credential_mode = 'hybrid-metered')::int as hybrid_variables
       from sovereign_variables
      where is_active = true
      group by vendor_key`
  );
  const linkedMap = new Map((linkedCounts.rows || []).map((row) => [row.vendor_key, row]));

  const builtins = getVendorCatalog().map((catalogEntry) => {
    const row = registry.get(catalogEntry.key);
    const linked = linkedMap.get(catalogEntry.key);
    return {
      ...catalogEntry,
      ops_status: row?.ops_status || (catalogEntry.configured ? "configured" : "missing"),
      preferred_credential_mode: row?.preferred_credential_mode || "platform-shared",
      notes: row?.notes || "",
      metadata: row?.metadata || {},
      updated_at: row?.updated_at || null,
      linked_variables: linked?.total_variables || 0,
      linked_shared_variables: linked?.shared_variables || 0,
      linked_customer_variables: linked?.customer_variables || 0,
      linked_hybrid_variables: linked?.hybrid_variables || 0
    };
  });

  const custom = [];
  for (const [vendor_key, row] of registry.entries()) {
    if (VENDOR_MAP.has(vendor_key)) continue;
    const linked = linkedMap.get(vendor_key);
    custom.push({
      key: vendor_key,
      name: row.display_name || vendor_key,
      category: row.category || "custom",
      env: [],
      capabilities: [],
      configured: false,
      env_status: [],
      ops_status: row.ops_status || "configured",
      preferred_credential_mode: row.preferred_credential_mode || "platform-shared",
      notes: row.notes || "",
      metadata: row.metadata || {},
      updated_at: row.updated_at || null,
      linked_variables: linked?.total_variables || 0,
      linked_shared_variables: linked?.shared_variables || 0,
      linked_customer_variables: linked?.customer_variables || 0,
      linked_hybrid_variables: linked?.hybrid_variables || 0
    });
  }

  return builtins.concat(custom);
}

export async function upsertVendorRegistry(input) {
  const vendor_key = normalizeText(input?.vendor_key, 80).toLowerCase();
  if (!vendor_key) throw new Error("vendor_key is required");
  const catalog = VENDOR_MAP.get(vendor_key);

  const display_name = normalizeNullableText(input?.display_name || catalog?.name || vendor_key, 120);
  const category = normalizeNullableText(input?.category || catalog?.category || "custom", 80);
  const ops_status = normalizeNullableText(input?.ops_status || "configured", 40);
  const preferred_credential_mode = normalizeNullableText(input?.preferred_credential_mode || "platform-shared", 40);
  const notes = normalizeNullableText(input?.notes, 4000);
  const metadata = parseJsonObject(input?.metadata, {});

  const res = await q(
    `insert into vendor_registry(vendor_key, display_name, category, ops_status, preferred_credential_mode, notes, metadata)
     values ($1,$2,$3,$4,$5,$6,$7::jsonb)
     on conflict (vendor_key)
     do update set display_name = excluded.display_name,
                   category = excluded.category,
                   ops_status = excluded.ops_status,
                   preferred_credential_mode = excluded.preferred_credential_mode,
                   notes = excluded.notes,
                   metadata = excluded.metadata,
                   updated_at = now()
     returning vendor_key, display_name, category, ops_status, preferred_credential_mode, notes, metadata, updated_at`,
    [vendor_key, display_name, category, ops_status, preferred_credential_mode, notes, JSON.stringify(metadata)]
  );
  return res.rows?.[0] || null;
}

export async function listSovereignVariables(filters = {}) {
  const where = [];
  const params = [];
  let i = 1;

  const scope_kind = normalizeNullableText(filters.scope_kind, 32);
  const scope_id = normalizeNullableText(filters.scope_id, 160);
  const vendor_key = normalizeNullableText(filters.vendor_key, 80)?.toLowerCase() || null;

  if (scope_kind) { where.push(`scope_kind = $${i++}`); params.push(scope_kind); }
  if (scope_id) { where.push(`scope_id = $${i++}`); params.push(scope_id); }
  if (vendor_key) { where.push(`vendor_key = $${i++}`); params.push(vendor_key); }

  const sql = `
    select id, scope_kind, scope_id, vendor_key, variable_name,
           credential_mode, usage_mode, billing_mode, last4, is_active,
           notes, metadata, created_at, updated_at
      from sovereign_variables
      ${where.length ? `where ${where.join(" and ")}` : ""}
     order by updated_at desc, id desc
     limit 500
  `;
  const res = await q(sql, params);
  return res.rows || [];
}

export async function upsertSovereignVariable(input) {
  const scope_kind = parseScopeKind(input?.scope_kind);
  const scope_id = normalizeText(input?.scope_id || "global", 160);
  const vendor_key = normalizeText(input?.vendor_key, 80).toLowerCase();
  const variable_name = normalizeText(input?.variable_name, 160);
  const secret_plain = String(input?.secret_plain || "");
  const credential_mode = normalizeNullableText(input?.credential_mode || "platform-shared", 40);
  const usage_mode = normalizeNullableText(input?.usage_mode || "development-and-production", 60);
  const billing_mode = normalizeNullableText(input?.billing_mode || "metered-through-gate", 60);
  const notes = normalizeNullableText(input?.notes, 4000);
  const metadata = parseJsonObject(input?.metadata, {});
  const is_active = input?.is_active === false ? false : true;

  if (!vendor_key) throw new Error("vendor_key is required");
  if (!variable_name) throw new Error("variable_name is required");
  if (!secret_plain.trim()) throw new Error("secret_plain is required");

  const enc = encryptSecret(secret_plain.trim());
  const last4 = secretLast4(secret_plain);

  const res = await q(
    `insert into sovereign_variables(
        scope_kind, scope_id, vendor_key, variable_name, secret_enc, last4,
        credential_mode, usage_mode, billing_mode, is_active, notes, metadata
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
      on conflict (scope_kind, scope_id, vendor_key, variable_name)
      do update set secret_enc = excluded.secret_enc,
                    last4 = excluded.last4,
                    credential_mode = excluded.credential_mode,
                    usage_mode = excluded.usage_mode,
                    billing_mode = excluded.billing_mode,
                    is_active = excluded.is_active,
                    notes = excluded.notes,
                    metadata = excluded.metadata,
                    updated_at = now()
      returning id, scope_kind, scope_id, vendor_key, variable_name, credential_mode, usage_mode, billing_mode, last4, is_active, notes, metadata, created_at, updated_at`,
    [
      scope_kind,
      scope_id,
      vendor_key,
      variable_name,
      enc,
      last4,
      credential_mode,
      usage_mode,
      billing_mode,
      is_active,
      notes,
      JSON.stringify(metadata)
    ]
  );
  return res.rows?.[0] || null;
}

export async function deleteSovereignVariable(id) {
  const numericId = Number.parseInt(String(id || ""), 10);
  if (!Number.isFinite(numericId) || numericId <= 0) throw new Error("Valid variable id required");
  await q(`delete from sovereign_variables where id = $1`, [numericId]);
  return { ok: true };
}
