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
    mode: 'file-plus-neon-backup-lane',
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
    return { ok:true, configured:true, pgAvailable:true, mirrored:true, mode: config.mode, latestSnapshot: res.rows[0], summary };
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

module.exports = { PHC_SCHEMA_SQL, readNeonConfig, ensureSchema, summarizeState, mirrorOrgStateToNeon, fetchLatestNeonSnapshot, getNeonHealth };
