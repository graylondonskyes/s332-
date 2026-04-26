CREATE TABLE IF NOT EXISTS product_variants (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  sku TEXT NOT NULL DEFAULT '',
  option1 TEXT NOT NULL DEFAULT '',
  option2 TEXT NOT NULL DEFAULT '',
  option3 TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL DEFAULT 0,
  compare_at_cents INTEGER NOT NULL DEFAULT 0,
  inventory_on_hand INTEGER NOT NULL DEFAULT 0,
  track_inventory INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS checkout_sessions (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  customer_id TEXT,
  customer_email TEXT NOT NULL DEFAULT '',
  customer_name TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'storefront',
  status TEXT NOT NULL DEFAULT 'open',
  items_json TEXT NOT NULL DEFAULT '[]',
  shipping_address_json TEXT NOT NULL DEFAULT '{}',
  quote_json TEXT NOT NULL DEFAULT '{}',
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  shipping_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  recovery_count INTEGER NOT NULL DEFAULT 0,
  last_recovered_at TEXT,
  converted_order_id TEXT,
  meta_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customer_accounts(id) ON DELETE SET NULL,
  FOREIGN KEY (converted_order_id) REFERENCES orders(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS gift_cards (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  code_last4 TEXT NOT NULL DEFAULT '',
  customer_email TEXT NOT NULL DEFAULT '',
  initial_balance_cents INTEGER NOT NULL DEFAULT 0,
  balance_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  note TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
  UNIQUE (merchant_id, code_hash)
);

CREATE TABLE IF NOT EXISTS gift_card_ledger (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  gift_card_id TEXT NOT NULL,
  order_id TEXT,
  kind TEXT NOT NULL DEFAULT 'issued',
  amount_cents INTEGER NOT NULL DEFAULT 0,
  balance_after_cents INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
  FOREIGN KEY (gift_card_id) REFERENCES gift_cards(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS risk_assessments (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  order_id TEXT,
  score INTEGER NOT NULL DEFAULT 0,
  decision TEXT NOT NULL DEFAULT 'approve',
  reasons_json TEXT NOT NULL DEFAULT '[]',
  signals_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  events_json TEXT NOT NULL DEFAULT '[]',
  secret_hash TEXT NOT NULL DEFAULT '',
  secret_preview TEXT NOT NULL DEFAULT '',
  headers_json TEXT NOT NULL DEFAULT '{}',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  endpoint_id TEXT,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  http_status INTEGER NOT NULL DEFAULT 0,
  response_text TEXT NOT NULL DEFAULT '',
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  delivered_at TEXT,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
  FOREIGN KEY (endpoint_id) REFERENCES webhook_endpoints(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  merchant_id TEXT,
  actor_role TEXT NOT NULL DEFAULT 'system',
  actor_ref TEXT NOT NULL DEFAULT '',
  event_type TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  target_type TEXT NOT NULL DEFAULT '',
  target_id TEXT NOT NULL DEFAULT '',
  meta_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
);

ALTER TABLE orders ADD COLUMN gift_card_code_last4 TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN gift_card_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN checkout_session_id TEXT REFERENCES checkout_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants (product_id, position ASC);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_merchant ON checkout_sessions (merchant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_status ON checkout_sessions (merchant_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_gift_cards_merchant ON gift_cards (merchant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_gift_card_ledger_card ON gift_card_ledger (gift_card_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_merchant ON risk_assessments (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_merchant ON webhook_endpoints (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_merchant ON webhook_deliveries (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_merchant ON audit_events (merchant_id, created_at DESC);
