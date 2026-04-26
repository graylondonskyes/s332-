CREATE TABLE IF NOT EXISTS product_media (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  url TEXT NOT NULL,
  alt TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'donor_ingest',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE (merchant_id, product_id, url)
);

CREATE TABLE IF NOT EXISTS donor_visual_imports (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  product_id TEXT,
  source_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  image_count INTEGER NOT NULL DEFAULT 0,
  selected_image_url TEXT NOT NULL DEFAULT '',
  result_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS fulfillment_sync_jobs (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT 'webhook',
  status TEXT NOT NULL DEFAULT 'queued',
  http_status INTEGER NOT NULL DEFAULT 0,
  request_json TEXT NOT NULL DEFAULT '{}',
  response_json TEXT NOT NULL DEFAULT '{}',
  error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS routex_handoffs (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  order_id TEXT,
  return_id TEXT,
  kind TEXT NOT NULL DEFAULT 'delivery',
  status TEXT NOT NULL DEFAULT 'queued',
  route_date TEXT NOT NULL DEFAULT '',
  external_ref TEXT NOT NULL DEFAULT '',
  request_json TEXT NOT NULL DEFAULT '{}',
  response_json TEXT NOT NULL DEFAULT '{}',
  error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  FOREIGN KEY (return_id) REFERENCES order_returns(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_product_media_product ON product_media (merchant_id, product_id, position ASC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_donor_visual_imports_merchant ON donor_visual_imports (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fulfillment_sync_jobs_order ON fulfillment_sync_jobs (merchant_id, order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_routex_handoffs_merchant ON routex_handoffs (merchant_id, created_at DESC);
