alter table articles add column if not exists language text not null default 'English';
alter table articles add column if not exists tone text not null default 'operator';
alter table articles add column if not exists call_to_action text not null default '';
alter table articles add column if not exists infographic_prompt text not null default '';
alter table articles add column if not exists claim_map_json jsonb not null default '[]'::jsonb;
alter table articles add column if not exists faq_items_json jsonb not null default '[]'::jsonb;

alter table publish_runs add column if not exists endpoint text;
alter table publish_runs add column if not exists status text not null default 'prepared';
alter table publish_runs add column if not exists remote_id text;
alter table publish_runs add column if not exists attempt_count integer not null default 0;
alter table publish_runs add column if not exists response_status integer;
alter table publish_runs add column if not exists response_excerpt text;
alter table publish_runs add column if not exists last_error text;
alter table publish_runs add column if not exists scheduled_for timestamptz;
alter table publish_runs add column if not exists last_attempt_at timestamptz;
alter table publish_runs add column if not exists executed_at timestamptz;

alter table visibility_runs add column if not exists prompt_pack_id text references saved_prompt_sets(id) on delete cascade;
alter table visibility_runs add column if not exists provider text not null default '';
alter table visibility_runs add column if not exists prompt text not null default '';
alter table visibility_runs add column if not exists answer_text text not null default '';

alter table evidence_exports add column if not exists subject_type text;
alter table evidence_exports add column if not exists subject_id text;
