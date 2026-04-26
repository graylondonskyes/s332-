-- v1.11.0 security/readiness hardening
-- Adds API rate-limit buckets and live provider validation proof runs.

CREATE TABLE IF NOT EXISTS api_rate_limits (
  bucket_key TEXT PRIMARY KEY,
  bucket_name TEXT NOT NULL,
  identity_hash TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  window_start TEXT NOT NULL,
  window_seconds INTEGER NOT NULL DEFAULT 60,
  request_count INTEGER NOT NULL DEFAULT 0,
  limit_count INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_identity ON api_rate_limits (identity_hash, bucket_name, window_start);
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_expires ON api_rate_limits (expires_at);

CREATE TABLE IF NOT EXISTS provider_validation_runs (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  connection_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'health',
  status TEXT NOT NULL,
  http_status INTEGER NOT NULL DEFAULT 0,
  missing_json TEXT NOT NULL DEFAULT '[]',
  result_json TEXT NOT NULL DEFAULT '{}',
  error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_provider_validation_runs_merchant ON provider_validation_runs (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_provider_validation_runs_connection ON provider_validation_runs (connection_id, created_at DESC);
