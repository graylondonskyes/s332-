-- Optional tenant guard strategy for Neon/Postgres.
-- Set the org context per request before querying:
--   select set_config('app.org_id', '<org-id>', true);

alter table workspaces enable row level security;
alter table projects enable row level security;
alter table jobs enable row level security;
alter table audit_runs enable row level security;
alter table content_plans enable row level security;
alter table saved_prompt_sets enable row level security;
alter table sources enable row level security;
alter table article_briefs enable row level security;
alter table articles enable row level security;
alter table publish_runs enable row level security;
alter table visibility_runs enable row level security;
alter table evidence_exports enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'workspace_org_policy') then
    create policy workspace_org_policy on workspaces using (org_id = current_setting('app.org_id', true));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'project_org_policy') then
    create policy project_org_policy on projects using (org_id = current_setting('app.org_id', true));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'job_org_policy') then
    create policy job_org_policy on jobs using (org_id = current_setting('app.org_id', true));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'audit_org_policy') then
    create policy audit_org_policy on audit_runs using (org_id = current_setting('app.org_id', true));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'content_plan_org_policy') then
    create policy content_plan_org_policy on content_plans using (org_id = current_setting('app.org_id', true));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'prompt_org_policy') then
    create policy prompt_org_policy on saved_prompt_sets using (org_id = current_setting('app.org_id', true));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'source_org_policy') then
    create policy source_org_policy on sources using (org_id = current_setting('app.org_id', true));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'brief_org_policy') then
    create policy brief_org_policy on article_briefs using (org_id = current_setting('app.org_id', true));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'article_org_policy') then
    create policy article_org_policy on articles using (org_id = current_setting('app.org_id', true));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'publish_org_policy') then
    create policy publish_org_policy on publish_runs using (org_id = current_setting('app.org_id', true));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'visibility_org_policy') then
    create policy visibility_org_policy on visibility_runs using (org_id = current_setting('app.org_id', true));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'evidence_org_policy') then
    create policy evidence_org_policy on evidence_exports using (org_id = current_setting('app.org_id', true));
  end if;
end $$;
