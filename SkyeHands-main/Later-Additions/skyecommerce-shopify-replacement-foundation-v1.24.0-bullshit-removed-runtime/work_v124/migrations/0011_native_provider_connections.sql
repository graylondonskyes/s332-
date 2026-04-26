CREATE TABLE IF NOT EXISTS provider_connections (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'production',
  account_label TEXT NOT NULL DEFAULT '',
  endpoint_base TEXT NOT NULL DEFAULT '',
  config_json TEXT NOT NULL DEFAULT '{}',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_provider_connections_merchant ON provider_connections (merchant_id, created_at DESC);
