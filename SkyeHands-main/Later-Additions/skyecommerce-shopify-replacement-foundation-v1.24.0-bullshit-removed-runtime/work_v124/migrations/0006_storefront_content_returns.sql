CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_mode TEXT NOT NULL DEFAULT 'manual',
  visible INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
  UNIQUE (merchant_id, slug)
);

CREATE TABLE IF NOT EXISTS collection_products (
  collection_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (collection_id, product_id),
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS content_pages (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  body_html TEXT NOT NULL DEFAULT '',
  visible INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
  UNIQUE (merchant_id, slug)
);

CREATE TABLE IF NOT EXISTS navigation_links (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  label TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'page',
  href TEXT NOT NULL DEFAULT '',
  target_ref TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  visible INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS order_returns (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'requested',
  reason TEXT NOT NULL DEFAULT '',
  customer_note TEXT NOT NULL DEFAULT '',
  merchant_note TEXT NOT NULL DEFAULT '',
  resolution_type TEXT NOT NULL DEFAULT 'refund',
  items_json TEXT NOT NULL DEFAULT '[]',
  requested_cents INTEGER NOT NULL DEFAULT 0,
  approved_cents INTEGER NOT NULL DEFAULT 0,
  refund_reference TEXT NOT NULL DEFAULT '',
  restock_items INTEGER NOT NULL DEFAULT 1,
  restocked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customer_accounts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_collections_merchant ON collections (merchant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_collection_products_collection ON collection_products (collection_id, position ASC);
CREATE INDEX IF NOT EXISTS idx_content_pages_merchant ON content_pages (merchant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_navigation_links_merchant ON navigation_links (merchant_id, position ASC);
CREATE INDEX IF NOT EXISTS idx_order_returns_merchant ON order_returns (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_returns_order ON order_returns (order_id, created_at DESC);
