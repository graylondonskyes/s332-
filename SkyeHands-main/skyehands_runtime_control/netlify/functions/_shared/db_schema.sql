-- SkyeHands / AE Command Hub — Canonical Database Schema
-- Directive section 6 — AE Command Hub Completion
-- Production target: Neon PostgreSQL
-- Local smoke target: SQLite (same schema with minor dialect adjustments)

-- ─── Extensions ────────────────────────────────────────────────────────────

-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";  -- Neon only

-- ─── Tenants ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tenants (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name         TEXT NOT NULL,
  plan         TEXT NOT NULL DEFAULT 'starter',
  status       TEXT NOT NULL DEFAULT 'active',
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Users ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id    TEXT NOT NULL REFERENCES tenants(id),
  email        TEXT NOT NULL UNIQUE,
  display_name TEXT,
  role         TEXT NOT NULL DEFAULT 'viewer', -- founder | admin | ae_operator | client | viewer
  status       TEXT NOT NULL DEFAULT 'active',
  password_hash TEXT,
  last_login_at TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Sessions ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sessions (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id      TEXT NOT NULL REFERENCES users(id),
  tenant_id    TEXT NOT NULL REFERENCES tenants(id),
  token_hash   TEXT NOT NULL UNIQUE,
  expires_at   TEXT NOT NULL,
  revoked      INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── AE Brains ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ae_brains (
  id              TEXT PRIMARY KEY, -- matches ae_brain_registry.js id
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  status          TEXT NOT NULL DEFAULT 'active', -- active | paused | capped | failed | escalated
  current_task_id TEXT,
  last_active_at  TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Clients / CRM ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clients (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id    TEXT NOT NULL REFERENCES tenants(id),
  name         TEXT NOT NULL,
  email        TEXT,
  phone        TEXT,
  status       TEXT NOT NULL DEFAULT 'prospect', -- prospect | active | paused | churned
  source       TEXT,
  assigned_brain_id TEXT,
  notes        TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Leads ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS leads (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id    TEXT NOT NULL REFERENCES tenants(id),
  client_id    TEXT REFERENCES clients(id),
  name         TEXT,
  email        TEXT,
  phone        TEXT,
  score        INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'new', -- new | qualified | unqualified | converted
  source       TEXT,
  follow_up_at TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Tasks ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tasks (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id    TEXT NOT NULL REFERENCES tenants(id),
  brain_id     TEXT,
  client_id    TEXT REFERENCES clients(id),
  type         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'queued', -- queued | in-progress | completed | failed | blocked
  priority     INTEGER NOT NULL DEFAULT 5,
  payload      TEXT, -- JSON
  result       TEXT, -- JSON
  enqueued_at  TEXT NOT NULL DEFAULT (datetime('now')),
  started_at   TEXT,
  completed_at TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Threads (conversation) ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS threads (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id    TEXT NOT NULL REFERENCES tenants(id),
  client_id    TEXT REFERENCES clients(id),
  brain_id     TEXT,
  subject      TEXT,
  status       TEXT NOT NULL DEFAULT 'open', -- open | resolved | archived
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  thread_id    TEXT NOT NULL REFERENCES threads(id),
  tenant_id    TEXT NOT NULL REFERENCES tenants(id),
  role         TEXT NOT NULL, -- user | brain | system
  content      TEXT NOT NULL,
  brain_id     TEXT,
  provider     TEXT,
  model        TEXT,
  tokens       INTEGER,
  cost_usd     REAL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Appointments ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS appointments (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  client_id       TEXT REFERENCES clients(id),
  brain_id        TEXT,
  calendar_provider TEXT, -- google | microsoft | calendly
  external_event_id TEXT,
  title           TEXT NOT NULL,
  starts_at       TEXT NOT NULL,
  ends_at         TEXT,
  status          TEXT NOT NULL DEFAULT 'scheduled', -- scheduled | confirmed | cancelled | completed
  reminder_sent   INTEGER NOT NULL DEFAULT 0,
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Productization ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS productization_records (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  app_name        TEXT NOT NULL,
  app_shipment_id TEXT,
  status          TEXT NOT NULL DEFAULT 'open',
  current_stage   TEXT,
  pricing_usd     REAL,
  pricing_model   TEXT,
  published_to    TEXT, -- JSON array
  audit_trail     TEXT, -- JSON array
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── SkyeHands Workspaces ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workspaces (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  owner_id        TEXT NOT NULL REFERENCES users(id),
  name            TEXT NOT NULL,
  language_stack  TEXT,
  runtime_profile TEXT,
  env_profile     TEXT, -- JSON
  status          TEXT NOT NULL DEFAULT 'active', -- active | paused | archived | deleted
  fs_root         TEXT,
  snapshot_path   TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Audit Log ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id    TEXT,
  actor_id     TEXT,
  brain_id     TEXT,
  action       TEXT NOT NULL,
  entity_type  TEXT,
  entity_id    TEXT,
  detail       TEXT,
  at           TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Usage Ledger ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS usage_ledger (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  brain_id      TEXT,
  provider      TEXT NOT NULL,
  model         TEXT,
  input_tokens  INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd      REAL NOT NULL DEFAULT 0,
  at            TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Indexes ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clients_tenant ON clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_tenant ON leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tasks_brain ON tasks(brain_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_threads_client ON threads(client_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant ON appointments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_tenant ON workspaces(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant ON audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usage_ledger_brain ON usage_ledger(brain_id);
