CREATE TABLE IF NOT EXISTS payment_transactions (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
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
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notification_messages (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  order_id TEXT,
  customer_id TEXT,
  channel TEXT NOT NULL DEFAULT 'email',
  template_key TEXT NOT NULL DEFAULT '',
  recipient TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  body_text TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'queued',
  provider_ref TEXT NOT NULL DEFAULT '',
  meta_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TEXT,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  FOREIGN KEY (customer_id) REFERENCES customer_accounts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS tax_nexus_rules (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT 'Economic nexus',
  country_code TEXT NOT NULL DEFAULT 'US',
  state_code TEXT NOT NULL DEFAULT '',
  threshold_cents INTEGER NOT NULL DEFAULT 0,
  threshold_orders INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tax_nexus_rollups (
  merchant_id TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'US',
  state_code TEXT NOT NULL DEFAULT '',
  order_count INTEGER NOT NULL DEFAULT 0,
  gross_cents INTEGER NOT NULL DEFAULT 0,
  threshold_met INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (merchant_id, country_code, state_code),
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_merchant ON payment_transactions (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order ON payment_transactions (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_messages_merchant ON notification_messages (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_messages_order ON notification_messages (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tax_nexus_rules_merchant ON tax_nexus_rules (merchant_id, created_at DESC);
