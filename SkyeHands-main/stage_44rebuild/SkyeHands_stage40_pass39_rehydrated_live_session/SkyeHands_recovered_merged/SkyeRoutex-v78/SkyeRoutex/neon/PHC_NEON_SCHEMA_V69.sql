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
