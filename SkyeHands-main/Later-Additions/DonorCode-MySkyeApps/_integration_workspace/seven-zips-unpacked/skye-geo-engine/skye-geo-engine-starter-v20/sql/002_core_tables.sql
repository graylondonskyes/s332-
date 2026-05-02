create table if not exists orgs (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists users (
  id text primary key,
  email text,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists memberships (
  id text primary key,
  org_id text not null references orgs(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  role text not null default 'owner',
  created_at timestamptz not null default now()
);

create table if not exists workspaces (
  id text primary key,
  org_id text not null references orgs(id) on delete cascade,
  name text not null,
  brand text,
  niche text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists projects (
  id text primary key,
  org_id text not null references orgs(id) on delete cascade,
  workspace_id text not null references workspaces(id) on delete cascade,
  name text not null,
  primary_url text,
  audience text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists jobs (
  id text primary key,
  org_id text not null references orgs(id) on delete cascade,
  workspace_id text not null references workspaces(id) on delete cascade,
  project_id text references projects(id) on delete cascade,
  type text not null,
  status text not null,
  summary text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audit_runs (
  id text primary key,
  org_id text not null references orgs(id) on delete cascade,
  workspace_id text not null references workspaces(id) on delete cascade,
  project_id text references projects(id) on delete cascade,
  target_url text not null,
  score integer not null,
  result_json jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists content_plans (
  id text primary key,
  org_id text not null references orgs(id) on delete cascade,
  workspace_id text not null references workspaces(id) on delete cascade,
  project_id text references projects(id) on delete cascade,
  brand text not null,
  niche text not null,
  audience text not null,
  result_json jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists saved_prompt_sets (
  id text primary key,
  org_id text not null references orgs(id) on delete cascade,
  workspace_id text not null references workspaces(id) on delete cascade,
  project_id text references projects(id) on delete cascade,
  brand text not null,
  niche text not null,
  market text,
  result_json jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists sources (
  id text primary key,
  org_id text not null references orgs(id) on delete cascade,
  workspace_id text not null references workspaces(id) on delete cascade,
  project_id text references projects(id) on delete cascade,
  source_url text,
  canonical_url text,
  site_name text,
  title text not null,
  snippet text not null,
  content_text text not null,
  content_hash text not null,
  retrieval_origin text not null,
  retrieved_at timestamptz not null,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists article_briefs (
  id text primary key,
  org_id text not null references orgs(id) on delete cascade,
  workspace_id text not null references workspaces(id) on delete cascade,
  project_id text references projects(id) on delete cascade,
  title text not null,
  primary_keyword text not null,
  brief_json jsonb not null,
  source_ids_json jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists articles (
  id text primary key,
  org_id text not null references orgs(id) on delete cascade,
  workspace_id text not null references workspaces(id) on delete cascade,
  project_id text references projects(id) on delete cascade,
  brief_id text not null references article_briefs(id) on delete cascade,
  title text not null,
  slug text not null,
  body_html text not null,
  json_ld text not null,
  citations_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists publish_runs (
  id text primary key,
  org_id text not null references orgs(id) on delete cascade,
  workspace_id text not null references workspaces(id) on delete cascade,
  project_id text references projects(id) on delete cascade,
  article_id text references articles(id) on delete set null,
  platform text not null,
  payload_json jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists visibility_runs (
  id text primary key,
  org_id text not null references orgs(id) on delete cascade,
  workspace_id text not null references workspaces(id) on delete cascade,
  project_id text references projects(id) on delete cascade,
  prompt_pack_id text references saved_prompt_sets(id) on delete cascade,
  result_json jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists evidence_exports (
  id text primary key,
  org_id text not null references orgs(id) on delete cascade,
  workspace_id text not null references workspaces(id) on delete cascade,
  project_id text references projects(id) on delete cascade,
  export_type text not null,
  payload_json jsonb not null,
  created_at timestamptz not null default now()
);

create trigger trg_workspaces_updated_at
before update on workspaces
for each row execute function touch_updated_at();

create trigger trg_projects_updated_at
before update on projects
for each row execute function touch_updated_at();

create trigger trg_jobs_updated_at
before update on jobs
for each row execute function touch_updated_at();
