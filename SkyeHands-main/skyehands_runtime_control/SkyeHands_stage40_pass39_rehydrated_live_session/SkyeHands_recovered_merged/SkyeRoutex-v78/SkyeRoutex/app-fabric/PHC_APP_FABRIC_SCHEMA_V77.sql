-- PHC shared app fabric schema V77
create table if not exists app_registry (
  app_slug text primary key,
  title text not null,
  route text not null,
  app_type text not null,
  status text not null default 'active',
  manifest_source text,
  certification_status text default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists app_bindings (
  binding_id text primary key,
  app_slug text not null,
  shell_slug text not null,
  binding_mode text not null,
  created_at timestamptz default now()
);
create table if not exists app_events (
  event_id text primary key,
  app_slug text not null,
  kind text not null,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);
create table if not exists app_snapshots (
  snapshot_id text primary key,
  app_slug text not null,
  revision text not null,
  snapshot_json jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);
create table if not exists app_certifications (
  certification_id text primary key,
  app_slug text not null,
  status text not null,
  score integer not null default 0,
  report_json jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);
create table if not exists app_button_audits (
  audit_id text primary key,
  app_slug text not null,
  total_buttons integer not null default 0,
  dead_buttons integer not null default 0,
  report_json jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);
create table if not exists app_rbac_policies (
  policy_id text primary key,
  app_slug text not null,
  role_key text not null,
  permissions_json jsonb not null default '[]'::jsonb,
  scopes_json jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);
create table if not exists app_tenant_policies (
  policy_id text primary key,
  app_slug text not null,
  storage_namespace text not null,
  db_schema text not null,
  allowed_targets_json jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);
create table if not exists app_deployment_receipts (
  receipt_id text primary key,
  app_slug text not null,
  status text not null,
  receipt_json jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);
