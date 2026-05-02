-- Skye Mail Vault schema (Neon Postgres) — Full Gmail command center
-- Includes Gmail mailbox linkage, push-watch state, contacts sync, local prefs, and secure vault tables.

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  handle text unique not null,
  email text unique not null,
  password_hash text not null,

  recovery_enabled boolean not null default false,
  recovery_blob_json text,

  created_at timestamptz not null default now()
);

create table if not exists user_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  version integer not null,
  is_active boolean not null default false,

  rsa_public_key_pem text not null,
  vault_wrap_json text not null,

  created_at timestamptz not null default now(),
  unique(user_id, version)
);

create index if not exists idx_user_keys_user_active on user_keys(user_id, is_active);
create index if not exists idx_user_keys_user_version on user_keys(user_id, version);

create table if not exists threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token text unique not null,
  from_name text,
  from_email text,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);

create index if not exists idx_threads_user_created on threads(user_id, created_at desc);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  thread_id uuid references threads(id) on delete set null,

  from_name text,
  from_email text,

  key_version integer not null,

  encrypted_key_b64 text not null,
  iv_b64 text not null,
  ciphertext_b64 text not null,

  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists idx_messages_user_created on messages(user_id, created_at desc);
create index if not exists idx_messages_thread_created on messages(thread_id, created_at desc);

create table if not exists attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages(id) on delete cascade,

  filename text not null,
  mime_type text not null,
  size_bytes integer not null,

  encrypted_key_b64 text not null,
  iv_b64 text not null,
  ciphertext bytea not null,

  created_at timestamptz not null default now()
);

create index if not exists idx_attachments_message on attachments(message_id);

create table if not exists google_mailboxes (
  user_id uuid primary key references users(id) on delete cascade,
  google_email text not null,
  from_name text,
  access_token_enc text not null,
  refresh_token_enc text not null,
  token_type text,
  scope text,
  expires_at timestamptz,
  history_id text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_google_mailboxes_email on google_mailboxes(lower(google_email));

alter table if exists google_mailboxes add column if not exists watch_topic text;
alter table if exists google_mailboxes add column if not exists watch_expiration timestamptz;
alter table if exists google_mailboxes add column if not exists watch_status text not null default 'inactive';
alter table if exists google_mailboxes add column if not exists watch_last_error text;
alter table if exists google_mailboxes add column if not exists push_enabled boolean not null default false;
alter table if exists google_mailboxes add column if not exists sync_version bigint not null default 0;
alter table if exists google_mailboxes add column if not exists last_notification_history_id text;
alter table if exists google_mailboxes add column if not exists last_notification_at timestamptz;
alter table if exists google_mailboxes add column if not exists last_sync_at timestamptz;
alter table if exists google_mailboxes add column if not exists full_sync_required boolean not null default false;
alter table if exists google_mailboxes add column if not exists contacts_last_sync_at timestamptz;
alter table if exists google_mailboxes add column if not exists contacts_last_sync_count integer not null default 0;
alter table if exists google_mailboxes add column if not exists contacts_sync_error text;

create index if not exists idx_google_mailboxes_watch_expiration on google_mailboxes(watch_expiration);
create index if not exists idx_google_mailboxes_push_enabled on google_mailboxes(push_enabled);

create table if not exists user_preferences (
  user_id uuid primary key references users(id) on delete cascade,
  display_name text,
  profile_title text,
  profile_phone text,
  profile_company text,
  profile_website text,
  signature_text text,
  signature_html text,
  preferred_from_alias text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists user_preferences add column if not exists preferred_from_alias text;

create table if not exists mail_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  email text not null,
  full_name text,
  company text,
  phone text,
  notes text,
  favorite boolean not null default false,
  source text not null default 'local',
  source_resource_name text,
  source_etag text,
  source_metadata_json text,
  photo_url text,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, email)
);

alter table if exists mail_contacts add column if not exists phone text;
alter table if exists mail_contacts add column if not exists source text not null default 'local';
alter table if exists mail_contacts add column if not exists source_resource_name text;
alter table if exists mail_contacts add column if not exists source_etag text;
alter table if exists mail_contacts add column if not exists source_metadata_json text;
alter table if exists mail_contacts add column if not exists photo_url text;

create index if not exists idx_mail_contacts_user_order on mail_contacts(user_id, favorite desc, updated_at desc);
create unique index if not exists idx_mail_contacts_user_email_lower on mail_contacts(user_id, lower(email));
create index if not exists idx_mail_contacts_source on mail_contacts(user_id, source, source_resource_name);
