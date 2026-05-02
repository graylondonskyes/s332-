const { clean, compact, nowISO, clone, bundlePushSummary } = require('./housecircle-cloud-store');

const PHC_SCHEMA_SQL = `
create table if not exists phc_org_snapshots (
  id bigserial primary key,
  org_id text not null,
  revision text not null,
  source_lane text not null default 'file-backed-mirror',
  generated_at timestamptz not null default now(),
  summary jsonb not null default '{}'::jsonb,
  payload jsonb not null,
  valuation_total numeric,
  walkthrough_sections integer,
  created_at timestamptz not null default now()
);
create index if not exists phc_org_snapshots_org_id_created_idx on phc_org_snapshots (org_id, created_at desc);
create index if not exists phc_org_snapshots_revision_idx on phc_org_snapshots (org_id, revision);

create table if not exists phc_replica_events (
  id bigserial primary key,
  org_id text not null,
  event_kind text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists phc_replica_events_org_id_created_idx on phc_replica_events (org_id, created_at desc);

create table if not exists phc_operational_events (
  id text primary key,
  org_id text not null,
  kind text not null,
  note text,
  detail jsonb not null default '{}'::jsonb,
  happened_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists phc_operational_events_org_created_idx on phc_operational_events (org_id, created_at desc);

create table if not exists phc_payment_ledger (
  id text primary key,
  org_id text not null,
  type text not null,
  provider text not null,
  status text not null,
  amount integer,
  currency text,
  order_id text,
  payment_ref text,
  operator_id text,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists phc_payment_ledger_org_created_idx on phc_payment_ledger (org_id, created_at desc);

create table if not exists phc_webhook_replay_ledger (
  provider text not null,
  event_id text not null,
  org_id text not null,
  detail jsonb not null default '{}'::jsonb,
  accepted_at timestamptz not null default now(),
  primary key(provider, event_id)
);

create table if not exists phc_active_sessions (
  sid text primary key,
  org_id text not null,
  operator_id text,
  role text,
  device_id text,
  expires_at timestamptz,
  trusted_device boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists phc_active_sessions_org_idx on phc_active_sessions (org_id, updated_at desc);

`;

function canRequirePg(){
  try{ require.resolve('pg'); return true; }catch(_){ return false; }
}

function readNeonConfig(){
  const connectionString = clean(process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || process.env.PHC_NEON_DATABASE_URL);
  const branch = compact(process.env.NEON_BRANCH || process.env.PHC_NEON_BRANCH || '');
  const schema = compact(process.env.PHC_NEON_SCHEMA || 'public');
  const enabled = !!connectionString;
  return {
    enabled,
    configured: enabled,
    connectionString,
    branch,
    schema,
    mode: process.env.PHC_REQUIRE_NEON_PRIMARY === '1' ? 'neon-primary-operational-store' : 'file-primary-neon-mirror',
    ssl: clean(process.env.PHC_NEON_SSL || 'require') !== 'disable'
  };
}

async function withPgClient(fn){
  const config = readNeonConfig();
  if(!config.enabled){
    return { ok:false, configured:false, reason:'No Neon connection string configured.', mode: config.mode };
  }
  if(!canRequirePg()){
    return { ok:false, configured:true, pgAvailable:false, reason:'pg dependency not installed yet.', mode: config.mode };
  }
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: config.connectionString, ssl: config.ssl ? { rejectUnauthorized:false } : false, max: 1, idleTimeoutMillis: 5000, connectionTimeoutMillis: 5000 });
  const client = await pool.connect();
  try{ return await fn(client, config); } finally { client.release(); await pool.end(); }
}

async function ensureSchema(){
  return withPgClient(async (client, config) => {
    await client.query(PHC_SCHEMA_SQL);
    return { ok:true, configured:true, pgAvailable:true, schemaReady:true, schema: config.schema, mode: config.mode };
  });
}

function summarizeState(state){
  const bundle = state && state.bundle || {};
  const summary = bundlePushSummary(bundle);
  return {
    ...summary,
    sessions: Array.isArray(state && state.sessions) ? state.sessions.length : 0,
    devices: Array.isArray(state && state.devices) ? state.devices.length : 0,
    jobs: Array.isArray(state && state.jobs) ? state.jobs.length : 0,
    locks: Array.isArray(state && state.locks) ? state.locks.length : 0,
    revision: clean(state && state.revision),
    updatedAt: clean(state && state.updatedAt)
  };
}



async function mirrorOperationalTables(client, orgId, snapshot){
  const safeOrg = clean(orgId) || 'default-org';
  const sessions = Array.isArray(snapshot.sessions) ? snapshot.sessions : [];
  for(const row of sessions){
    if(!clean(row.sid)) continue;
    await client.query(
      `insert into phc_active_sessions (sid, org_id, operator_id, role, device_id, expires_at, trusted_device, payload, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,now())
       on conflict (sid) do update set org_id=excluded.org_id, operator_id=excluded.operator_id, role=excluded.role, device_id=excluded.device_id, expires_at=excluded.expires_at, trusted_device=excluded.trusted_device, payload=excluded.payload, updated_at=now()`,
      [clean(row.sid), safeOrg, clean(row.operatorId), clean(row.role), clean(row.deviceId), clean(row.expiresAt) || null, !!row.trustedDevice, JSON.stringify(row)]
    );
  }
  const events = Array.isArray(snapshot.eventLog) ? snapshot.eventLog.slice(0, 250) : [];
  for(const row of events){
    const id = clean(row.id); if(!id) continue;
    await client.query(
      `insert into phc_operational_events (id, org_id, kind, note, detail, happened_at)
       values ($1,$2,$3,$4,$5::jsonb,coalesce($6::timestamptz, now()))
       on conflict (id) do update set org_id=excluded.org_id, kind=excluded.kind, note=excluded.note, detail=excluded.detail, happened_at=excluded.happened_at`,
      [id, safeOrg, compact(row.kind || 'event'), compact(row.note || ''), JSON.stringify(row.detail || row), clean(row.at) || null]
    );
  }
  const payments = Array.isArray(snapshot.paymentLedger) ? snapshot.paymentLedger : [];
  for(const row of payments){
    const id = clean(row.id); if(!id) continue;
    await client.query(
      `insert into phc_payment_ledger (id, org_id, type, provider, status, amount, currency, order_id, payment_ref, operator_id, payload, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,now())
       on conflict (id) do update set org_id=excluded.org_id, type=excluded.type, provider=excluded.provider, status=excluded.status, amount=excluded.amount, currency=excluded.currency, order_id=excluded.order_id, payment_ref=excluded.payment_ref, operator_id=excluded.operator_id, payload=excluded.payload, updated_at=now()`,
      [id, safeOrg, compact(row.type || 'payment_ledger'), compact(row.provider || 'provider'), compact(row.status || 'recorded'), Number(row.amount || 0) || null, compact(row.currency || ''), clean(row.orderId || ''), clean(row.paymentRef || row.paymentIntentId || row.paymentId || ''), clean(row.operatorId || ''), JSON.stringify(row)]
    );
  }
  const replay = Array.isArray(snapshot.webhookReplayLedger) ? snapshot.webhookReplayLedger : [];
  for(const row of replay){
    const provider = compact(row.provider); const eventId = clean(row.eventId); if(!provider || !eventId) continue;
    await client.query(
      `insert into phc_webhook_replay_ledger (provider, event_id, org_id, detail, accepted_at)
       values ($1,$2,$3,$4::jsonb,coalesce($5::timestamptz, now()))
       on conflict (provider, event_id) do nothing`,
      [provider, eventId, safeOrg, JSON.stringify(row.detail || row), clean(row.acceptedAt) || null]
    );
  }
  return { sessions:sessions.length, events:events.length, payments:payments.length, replay:replay.length };
}

async function mirrorOrgStateToNeon(orgId, state, meta){
  meta = meta || {};
  const safeOrg = clean(orgId || state && state.orgId || 'default-org') || 'default-org';
  const snapshot = clone(state || {});
  const summary = summarizeState(snapshot);
  const valuationTotal = Number(snapshot && snapshot.bundle && snapshot.bundle.valuationCurrent && snapshot.bundle.valuationCurrent.totalValue || 0) || null;
  const walkthroughSections = Number(snapshot && snapshot.bundle && snapshot.bundle.walkthroughCurrent && snapshot.bundle.walkthroughCurrent.sectionCount || 0) || null;
  const ensured = await ensureSchema();
  if(!ensured.ok) return { ...ensured, mirrored:false, orgId: safeOrg };
  return withPgClient(async (client, config) => {
    const res = await client.query(
      `insert into phc_org_snapshots (org_id, revision, source_lane, generated_at, summary, payload, valuation_total, walkthrough_sections) values ($1,$2,$3,now(),$4::jsonb,$5::jsonb,$6,$7) returning id, org_id, revision, generated_at, source_lane`,
      [safeOrg, clean(snapshot.revision) || 'rev-unspecified', compact(meta.sourceLane || 'file-backed-mirror'), JSON.stringify(summary), JSON.stringify(snapshot), valuationTotal, walkthroughSections]
    );
    await client.query(`insert into phc_replica_events (org_id, event_kind, detail) values ($1,$2,$3::jsonb)`, [safeOrg, compact(meta.eventKind || 'mirror_push'), JSON.stringify({ note: compact(meta.note || 'Neon backup push complete.'), summary, revision: clean(snapshot.revision), generatedAt: nowISO() })]);
    const operational = await mirrorOperationalTables(client, safeOrg, snapshot);
    return { ok:true, configured:true, pgAvailable:true, mirrored:true, mode: config.mode, latestSnapshot: res.rows[0], summary, operational };
  });
}

async function fetchLatestNeonSnapshot(orgId){
  const safeOrg = clean(orgId) || 'default-org';
  const ensured = await ensureSchema();
  if(!ensured.ok) return { ...ensured, latestSnapshot:null, orgId: safeOrg };
  return withPgClient(async (client, config) => {
    const res = await client.query(`select id, org_id, revision, source_lane, generated_at, summary, payload, valuation_total, walkthrough_sections from phc_org_snapshots where org_id = $1 order by created_at desc limit 1`, [safeOrg]);
    return { ok:true, configured:true, pgAvailable:true, mode: config.mode, latestSnapshot: res.rows[0] || null, orgId: safeOrg };
  });
}

async function getNeonHealth(orgId){
  const config = readNeonConfig();
  if(!config.enabled){
    return { ok:true, configured:false, pgAvailable:canRequirePg(), mode: config.mode, latestSnapshot:null, orgId: clean(orgId) || 'default-org', reason:'Set NEON_DATABASE_URL to enable the enterprise backup lane.' };
  }
  if(!canRequirePg()){
    return { ok:false, configured:true, pgAvailable:false, mode: config.mode, latestSnapshot:null, orgId: clean(orgId) || 'default-org', reason:'pg dependency is not installed in this runtime yet.' };
  }
  try{
    const latest = await fetchLatestNeonSnapshot(orgId);
    return { ok: !!latest.ok, configured:true, pgAvailable:true, mode: config.mode, orgId: clean(orgId) || 'default-org', latestSnapshot: latest.latestSnapshot || null, branch: config.branch || '', schema: config.schema || 'public' };
  }catch(err){
    return { ok:false, configured:true, pgAvailable:true, mode: config.mode, orgId: clean(orgId) || 'default-org', latestSnapshot:null, error: clean(err && err.message) || 'Neon health probe failed.' };
  }
}

module.exports = { PHC_SCHEMA_SQL, readNeonConfig, ensureSchema, summarizeState, mirrorOrgStateToNeon, fetchLatestNeonSnapshot, getNeonHealth, mirrorOperationalTables };
