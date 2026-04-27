-- Optional: enable Row-Level Security policies.
-- Run after schema.sql and only after verifying the app calls rlsSetOrg(orgId) per request.
-- App context key: set_config('app.org_id', <uuid>, true)

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_projects_org ON projects;
CREATE POLICY p_projects_org ON projects
  USING (org_id = current_org_id())
  WITH CHECK (org_id = current_org_id());

ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_project_files_org ON project_files;
CREATE POLICY p_project_files_org ON project_files
  USING (EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_files.project_id AND p.org_id = current_org_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_files.project_id AND p.org_id = current_org_id()
  ));

ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_snapshots_org ON snapshots;
CREATE POLICY p_snapshots_org ON snapshots
  USING (EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = snapshots.project_id AND p.org_id = current_org_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = snapshots.project_id AND p.org_id = current_org_id()
  ));

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_audit_logs_org ON audit_logs;
CREATE POLICY p_audit_logs_org ON audit_logs
  USING (org_id = current_org_id())
  WITH CHECK (org_id = current_org_id());

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_memberships_org ON memberships;
CREATE POLICY p_memberships_org ON memberships
  USING (org_id = current_org_id())
  WITH CHECK (org_id = current_org_id());

ALTER TABLE scim_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_scim_tokens_org ON scim_tokens;
CREATE POLICY p_scim_tokens_org ON scim_tokens
  USING (org_id = current_org_id())
  WITH CHECK (org_id = current_org_id());

ALTER TABLE scim_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_scim_groups_org ON scim_groups;
CREATE POLICY p_scim_groups_org ON scim_groups
  USING (org_id = current_org_id())
  WITH CHECK (org_id = current_org_id());

ALTER TABLE scim_group_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_scim_group_members_org ON scim_group_members;
CREATE POLICY p_scim_group_members_org ON scim_group_members
  USING (EXISTS (
    SELECT 1 FROM scim_groups g
    WHERE g.id = scim_group_members.group_id AND g.org_id = current_org_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM scim_groups g
    WHERE g.id = scim_group_members.group_id AND g.org_id = current_org_id()
  ));

ALTER TABLE user_emails ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_user_emails_org ON user_emails;
CREATE POLICY p_user_emails_org ON user_emails
  USING (EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.user_id = user_emails.user_id AND m.org_id = current_org_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.user_id = user_emails.user_id AND m.org_id = current_org_id()
  ));

ALTER TABLE siem_outbox ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_siem_outbox_org ON siem_outbox;
CREATE POLICY p_siem_outbox_org ON siem_outbox
  USING (org_id = current_org_id())
  WITH CHECK (org_id = current_org_id());

ALTER TABLE org_siem_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_org_siem_configs_org ON org_siem_configs;
CREATE POLICY p_org_siem_configs_org ON org_siem_configs
  USING (org_id = current_org_id())
  WITH CHECK (org_id = current_org_id());

ALTER TABLE saml_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_saml_configs_org ON saml_configs;
CREATE POLICY p_saml_configs_org ON saml_configs
  USING (org_id = current_org_id())
  WITH CHECK (org_id = current_org_id());

ALTER TABLE saml_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_saml_sessions_org ON saml_sessions;
CREATE POLICY p_saml_sessions_org ON saml_sessions
  USING (org_id = current_org_id())
  WITH CHECK (org_id = current_org_id());
