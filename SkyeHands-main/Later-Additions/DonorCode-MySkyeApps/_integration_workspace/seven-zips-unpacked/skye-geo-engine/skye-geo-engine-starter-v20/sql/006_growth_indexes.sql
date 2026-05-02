create index if not exists idx_visibility_scope on visibility_runs(org_id, workspace_id, created_at desc);
create index if not exists idx_publish_status_scope on publish_runs(org_id, workspace_id, status, created_at desc);
create index if not exists idx_evidence_scope on evidence_exports(org_id, workspace_id, created_at desc);
