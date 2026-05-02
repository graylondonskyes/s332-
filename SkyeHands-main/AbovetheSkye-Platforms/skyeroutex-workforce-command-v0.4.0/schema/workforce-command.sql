-- SkyeRoutexFlow Workforce Command portable SQL handoff schema.
-- Target: Postgres/Neon first, Cloudflare D1 with light type adjustments.
-- This schema mirrors the local JSON entity graph so a production adapter has
-- a concrete contract instead of reverse-engineering server state.

create table if not exists users (
  id text primary key,
  email text not null unique,
  password_hash text not null,
  role text not null,
  status text not null,
  name text not null,
  city text,
  state text,
  invited_by text references users(id),
  invite_id text,
  created_at text not null,
  updated_at text not null
);

create table if not exists sessions (
  id text primary key,
  user_id text not null references users(id),
  created_at text not null,
  expires_at text not null
);

create table if not exists admin_invites (
  id text primary key,
  email text not null,
  role text not null,
  name text,
  token_hash text not null unique,
  created_by text not null references users(id),
  created_at text not null,
  expires_at text not null,
  used_at text,
  used_by text references users(id),
  revoked_at text,
  revoked_by text references users(id)
);

create table if not exists markets (
  id text primary key,
  city text not null,
  state text not null,
  status text not null,
  created_at text not null,
  unique(city, state)
);

create table if not exists contractor_profiles (
  user_id text primary key references users(id),
  skills_json text not null default '[]',
  service_radius_miles integer not null default 25,
  transportation_status text not null default 'unknown',
  reliability_score integer not null default 50,
  rating_avg real not null default 0,
  completed_jobs integer not null default 0
);

create table if not exists provider_profiles (
  user_id text primary key references users(id),
  company_name text not null,
  provider_type text not null,
  rating_avg real not null default 0,
  completed_jobs integer not null default 0
);

create table if not exists crew_profiles (
  user_id text primary key references users(id),
  crew_name text not null,
  member_count integer not null default 1,
  rating_avg real not null default 0,
  completed_jobs integer not null default 0
);

create table if not exists crew_members (
  id text primary key,
  crew_user_id text not null references users(id),
  member_user_id text references users(id),
  name text,
  role text,
  created_at text not null
);

create table if not exists jobs (
  id text primary key,
  provider_id text not null references users(id),
  market_id text not null references markets(id),
  title text not null,
  category text not null,
  description text not null,
  city text not null,
  state text not null,
  location text not null,
  starts_at text not null,
  ends_at text,
  pay_type text not null,
  pay_amount_cents integer not null,
  slots integer not null,
  acceptance_mode text not null,
  status text not null,
  proof_required integer not null default 1,
  route_required integer not null default 0,
  route_mode text not null default 'none',
  vehicle_type text,
  arrival_window text,
  created_at text not null,
  updated_at text not null
);

create table if not exists job_applications (
  id text primary key,
  job_id text not null references jobs(id),
  contractor_id text not null references users(id),
  note text,
  status text not null,
  created_at text not null,
  updated_at text not null,
  unique(job_id, contractor_id)
);

create table if not exists job_assignments (
  id text primary key,
  job_id text not null references jobs(id),
  application_id text references job_applications(id),
  contractor_id text not null references users(id),
  status text not null,
  confirmed_at text,
  on_way_at text,
  checked_in_at text,
  checked_out_at text,
  provider_approved_at text,
  assigned_by text references users(id),
  created_at text not null,
  updated_at text not null
);

create table if not exists proof_items (
  id text primary key,
  assignment_id text not null references job_assignments(id),
  proof_type text not null,
  body text not null,
  media_required integer not null default 0,
  media_id text,
  media_size_bytes integer,
  created_at text not null
);

create table if not exists proof_media (
  id text primary key,
  proof_id text not null references proof_items(id),
  storage_driver text not null,
  storage_path text not null,
  byte_size integer not null,
  sha256 text not null,
  mime_type text not null,
  created_at text not null
);

create table if not exists payment_ledger (
  id text primary key,
  job_id text not null references jobs(id),
  assignment_id text references job_assignments(id),
  contractor_id text references users(id),
  provider_id text not null references users(id),
  amount_cents integer not null,
  status text not null,
  reason text not null,
  provider_driver text,
  external_provider_id text,
  external_status text,
  external_dispatch_json text,
  created_at text not null,
  updated_at text not null
);

create table if not exists ratings (
  id text primary key,
  job_id text not null references jobs(id),
  from_user_id text not null references users(id),
  to_user_id text not null references users(id),
  score integer not null,
  note text,
  created_at text not null
);

create table if not exists provider_rosters (
  id text primary key,
  provider_id text not null references users(id),
  contractor_id text not null references users(id),
  created_at text not null,
  unique(provider_id, contractor_id)
);

create table if not exists provider_blocks (
  id text primary key,
  provider_id text not null references users(id),
  contractor_id text not null references users(id),
  reason text,
  created_at text not null
);

create table if not exists disputes (
  id text primary key,
  job_id text not null references jobs(id),
  assignment_id text not null references job_assignments(id),
  opened_by text not null references users(id),
  type text not null,
  body text not null,
  status text not null,
  resolution text,
  created_at text not null,
  updated_at text not null
);

create table if not exists dispute_evidence (
  id text primary key,
  dispute_id text not null references disputes(id),
  submitted_by text not null references users(id),
  body text not null,
  media_id text,
  created_at text not null
);

create table if not exists notifications (
  id text primary key,
  user_id text not null references users(id),
  title text not null,
  body text not null,
  channel text not null,
  delivery_provider text not null,
  delivery_status text not null,
  external_provider_id text,
  external_dispatch_json text,
  read_at text,
  created_at text not null,
  updated_at text
);

create table if not exists autonomous_recommendations (
  id text primary key,
  job_id text not null references jobs(id),
  contractor_id text not null references users(id),
  score integer not null,
  reasons_json text not null default '[]',
  created_at text not null
);

create table if not exists route_jobs (
  id text primary key,
  job_id text not null references jobs(id),
  mode text not null,
  vehicle_type text,
  arrival_window text,
  pickup_location text,
  dropoff_location text,
  status text not null,
  route_provider text,
  late_risk text,
  created_at text not null,
  updated_at text not null
);

create table if not exists route_stops (
  id text primary key,
  route_job_id text not null references route_jobs(id),
  job_id text not null references jobs(id),
  sequence integer not null,
  label text not null,
  address text not null,
  proof_required integer not null default 0,
  status text not null,
  route_provider text,
  planned_eta_minutes integer,
  proof_note text,
  completed_at text,
  created_at text not null,
  updated_at text not null
);

create table if not exists export_packets (
  id text primary key,
  type text not null,
  entity_id text not null,
  path text not null,
  byte_size integer,
  sha256 text,
  created_by text not null references users(id),
  created_at text not null
);

create table if not exists audit_events (
  id text primary key,
  actor_user_id text,
  event_type text not null,
  entity_type text not null,
  entity_id text not null,
  metadata_json text not null default '{}',
  previous_hash text,
  event_hash text not null,
  created_at text not null
);

create table if not exists runtime_events (
  id text primary key,
  provider text not null,
  event_type text not null,
  entity_type text not null,
  entity_id text not null,
  actor_user_id text,
  metadata_json text not null default '{}',
  created_at text not null
);

create table if not exists integration_outbox (
  id text primary key,
  provider_kind text not null,
  driver text not null,
  event_type text not null,
  entity_type text not null,
  entity_id text not null,
  status text not null,
  attempts integer not null default 0,
  payload_json text not null default '{}',
  last_error text,
  created_at text not null,
  updated_at text not null,
  dispatched_at text
);

create table if not exists provider_webhooks (
  id text primary key,
  provider text not null,
  event_type text not null,
  verified integer not null default 0,
  entity_type text,
  entity_id text,
  provider_event_id text,
  payload_json text not null default '{}',
  received_at text not null,
  processed_at text,
  processing_status text not null,
  error text
);

create table if not exists compliance_checks (
  id text primary key,
  user_id text not null references users(id),
  assignment_id text references job_assignments(id),
  role text,
  provider text not null,
  status text not null,
  checks_json text not null default '[]',
  external_provider_id text,
  external_dispatch_json text,
  created_at text not null,
  updated_at text
);

create table if not exists schema_migrations (
  version text primary key,
  name text not null,
  driver text not null,
  schema_path text not null,
  schema_sha256 text not null,
  local_collections_json text not null,
  sql_tables_json text not null,
  applied_at text not null
);

create index if not exists idx_jobs_market_status on jobs(market_id, status);
create index if not exists idx_jobs_provider on jobs(provider_id);
create index if not exists idx_admin_invites_email on admin_invites(email);
create index if not exists idx_applications_job on job_applications(job_id);
create index if not exists idx_assignments_job on job_assignments(job_id);
create index if not exists idx_assignments_contractor on job_assignments(contractor_id);
create index if not exists idx_payments_job on payment_ledger(job_id);
create index if not exists idx_payments_assignment on payment_ledger(assignment_id);
create index if not exists idx_audit_entity on audit_events(entity_type, entity_id);
create index if not exists idx_runtime_entity on runtime_events(entity_type, entity_id);
create index if not exists idx_integration_outbox_status on integration_outbox(status, provider_kind);
create index if not exists idx_provider_webhooks_provider_event on provider_webhooks(provider, provider_event_id);
