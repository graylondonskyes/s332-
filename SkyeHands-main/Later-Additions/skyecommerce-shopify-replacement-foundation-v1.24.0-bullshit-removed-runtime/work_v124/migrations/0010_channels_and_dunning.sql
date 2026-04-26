CREATE TABLE IF NOT EXISTS sales_channels (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'google_merchant',
  destination_url TEXT NOT NULL DEFAULT '',
  format TEXT NOT NULL DEFAULT 'json',
  config_json TEXT NOT NULL DEFAULT '{}',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS channel_sync_jobs (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  sales_channel_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  export_json TEXT NOT NULL DEFAULT '{}',
  result_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
  FOREIGN KEY (sales_channel_id) REFERENCES sales_channels(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS subscription_invoice_payments (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'manual',
  provider_reference TEXT NOT NULL DEFAULT '',
  checkout_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  payload_json TEXT NOT NULL DEFAULT '{}',
  authorized_at TEXT,
  captured_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
  FOREIGN KEY (invoice_id) REFERENCES subscription_invoices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS subscription_dunning_events (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  subscription_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'invoice_opened',
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
  FOREIGN KEY (subscription_id) REFERENCES customer_subscriptions(id) ON DELETE CASCADE,
  FOREIGN KEY (invoice_id) REFERENCES subscription_invoices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sales_channels_merchant ON sales_channels (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_channel_sync_jobs_channel ON channel_sync_jobs (sales_channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_invoice_payments_invoice ON subscription_invoice_payments (invoice_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_dunning_events_invoice ON subscription_dunning_events (invoice_id, created_at DESC);
