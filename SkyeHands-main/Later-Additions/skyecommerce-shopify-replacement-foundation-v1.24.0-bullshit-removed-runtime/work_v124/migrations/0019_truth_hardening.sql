-- v1.9.0 truth-hardening layer.
-- Removes non-live green-status behaviors by adding browser CSRF, idempotency replay, auth lockouts, and explicit queue dead-letter proof storage.
CREATE TABLE IF NOT EXISTS auth_security_events (
  id TEXT PRIMARY KEY,
  subject_hash TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'login',
  identity TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  success INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auth_lockouts (
  id TEXT PRIMARY KEY,
  subject_hash TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'login',
  identity TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  failure_count INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS idempotency_records (
  scope_hash TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  body_hash TEXT NOT NULL,
  status INTEGER NOT NULL DEFAULT 200,
  response_headers_json TEXT NOT NULL DEFAULT '{}',
  response_body TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (scope_hash, idempotency_key, method, path)
);

CREATE INDEX IF NOT EXISTS idx_auth_security_subject_time ON auth_security_events (subject_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_lockouts_subject_active ON auth_lockouts (subject_hash, active, locked_until);
CREATE INDEX IF NOT EXISTS idx_idempotency_records_updated ON idempotency_records (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_dead_letter ON notification_messages (merchant_id, status, updated_at);
CREATE INDEX IF NOT EXISTS idx_webhooks_dead_letter ON webhook_deliveries (merchant_id, status, updated_at);
