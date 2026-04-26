-- CodeFloor — Neon Postgres Schema
-- Run against your Neon database via psql or the Neon console

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ─── USERS ────────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id            TEXT PRIMARY KEY,              -- Netlify Identity sub
  email         TEXT UNIQUE NOT NULL,
  name          TEXT,
  avatar_url    TEXT,
  plan          TEXT NOT NULL DEFAULT 'solo',  -- solo | pro | agency
  plan_seats    INT  NOT NULL DEFAULT 1,
  stripe_id     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── ORGANIZATIONS (team workspaces) ──────────────────────────────────────────
CREATE TABLE orgs (
  id          TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
  name        TEXT NOT NULL,
  owner_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan        TEXT NOT NULL DEFAULT 'pro',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE org_members (
  org_id     TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member',  -- owner | admin | member
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);

-- ─── PROJECTS ─────────────────────────────────────────────────────────────────
CREATE TABLE projects (
  id              TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
  owner_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id          TEXT REFERENCES orgs(id) ON DELETE SET NULL,

  -- Identity
  name            TEXT NOT NULL,
  description     TEXT,
  category        TEXT,
  pass_name       TEXT,
  version         TEXT,

  -- Platform stats
  file_count      INT,
  proof_count     INT,
  highest_stage   TEXT,
  team_size       INT,
  has_revenue     BOOLEAN NOT NULL DEFAULT false,
  monthly_revenue NUMERIC(12,2),

  -- Floor
  base_floor      NUMERIC(10,4) NOT NULL DEFAULT 0,  -- in $M

  -- Metadata
  status          TEXT NOT NULL DEFAULT 'active',   -- active | archived
  share_token     TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  share_enabled   BOOLEAN NOT NULL DEFAULT false,
  notes           TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_owner  ON projects(owner_id);
CREATE INDEX idx_projects_org    ON projects(org_id);
CREATE INDEX idx_projects_share  ON projects(share_token);

-- ─── SECTIONS ─────────────────────────────────────────────────────────────────
CREATE TABLE sections (
  id          TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(10), 'hex'),
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  position    INT  NOT NULL DEFAULT 0,

  name        TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'Infrastructure',
  value_m     NUMERIC(10,4) NOT NULL DEFAULT 0,   -- value in $M
  status      TEXT NOT NULL DEFAULT 'open',        -- proven | aspirational | open
  evidence    TEXT,

  -- 5-gate checklist
  gate_code     BOOLEAN NOT NULL DEFAULT false,
  gate_runtime  BOOLEAN NOT NULL DEFAULT false,
  gate_hostile  BOOLEAN NOT NULL DEFAULT false,
  gate_artifact BOOLEAN NOT NULL DEFAULT false,
  gate_claim    BOOLEAN NOT NULL DEFAULT false,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sections_project ON sections(project_id, position);

-- ─── HONEST GAPS ──────────────────────────────────────────────────────────────
CREATE TABLE gaps (
  id          TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(10), 'hex'),
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  position    INT  NOT NULL DEFAULT 0,
  title       TEXT NOT NULL,
  detail      TEXT,
  status      TEXT NOT NULL DEFAULT 'open',    -- open | closed
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gaps_project ON gaps(project_id);

-- ─── COMPARABLES ──────────────────────────────────────────────────────────────
CREATE TABLE comps (
  id          TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(10), 'hex'),
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  position    INT  NOT NULL DEFAULT 0,
  name        TEXT NOT NULL,
  valuation_m NUMERIC(10,2) NOT NULL DEFAULT 0,
  dimension   TEXT,
  source      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comps_project ON comps(project_id);

-- ─── EVIDENCE FILES (R2 references) ───────────────────────────────────────────
CREATE TABLE evidence_files (
  id          TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(10), 'hex'),
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  section_id  TEXT REFERENCES sections(id) ON DELETE SET NULL,
  uploader_id TEXT NOT NULL REFERENCES users(id),
  filename    TEXT NOT NULL,
  r2_key      TEXT NOT NULL UNIQUE,
  mime_type   TEXT,
  size_bytes  BIGINT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_evidence_project ON evidence_files(project_id);

-- ─── REPORTS (generated snapshots) ───────────────────────────────────────────
CREATE TABLE reports (
  id            TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(10), 'hex'),
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by    TEXT NOT NULL REFERENCES users(id),
  r2_key        TEXT,                            -- PDF stored in R2
  floor_snapshot NUMERIC(10,4),                  -- floor at time of generation
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reports_project ON reports(project_id);

-- ─── INVITES ──────────────────────────────────────────────────────────────────
CREATE TABLE invites (
  id          TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(10), 'hex'),
  org_id      TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'member',
  token       TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  invited_by  TEXT NOT NULL REFERENCES users(id),
  accepted    BOOLEAN NOT NULL DEFAULT false,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── AUDIT LOG ────────────────────────────────────────────────────────────────
CREATE TABLE audit_log (
  id          BIGSERIAL PRIMARY KEY,
  user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  project_id  TEXT REFERENCES projects(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  detail      JSONB,
  ip          TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_user    ON audit_log(user_id);
CREATE INDEX idx_audit_project ON audit_log(project_id);
CREATE INDEX idx_audit_created ON audit_log(created_at);

-- ─── HELPER FUNCTIONS ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_projects_updated  BEFORE UPDATE ON projects  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_sections_updated  BEFORE UPDATE ON sections  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_users_updated     BEFORE UPDATE ON users     FOR EACH ROW EXECUTE FUNCTION update_updated_at();
