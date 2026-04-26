
create table if not exists ae_branch_state(id text primary key, payload jsonb);
create table if not exists ae_branch_usage_events(id text primary key, payload jsonb);
create table if not exists ae_branch_smoke_reports(id text primary key, payload jsonb);
create table if not exists ae_branch_state_versions(id text primary key, payload jsonb);
create table if not exists ae_branch_storage_sync_events(id text primary key, payload jsonb);
create table if not exists media_center_artists(id text primary key, payload jsonb);
create table if not exists media_center_entries(id text primary key, payload jsonb);
create table if not exists media_center_assets(id text primary key, payload jsonb);
create table if not exists media_center_video_variants(id text primary key, payload jsonb);
