CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  short_description TEXT NOT NULL DEFAULT '',
  description_html TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL DEFAULT 0,
  compare_at_cents INTEGER NOT NULL DEFAULT 0,
  sku TEXT NOT NULL DEFAULT '',
  inventory_on_hand INTEGER NOT NULL DEFAULT 0,
  track_inventory INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  hero_image_url TEXT NOT NULL DEFAULT '',
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_ref TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
  UNIQUE (merchant_id, slug)
);

CREATE TABLE IF NOT EXISTS shipping_profiles (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  origin_country TEXT NOT NULL DEFAULT 'US',
  origin_state TEXT NOT NULL DEFAULT '',
  rates_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tax_profiles (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT 'Sales tax',
  country_code TEXT NOT NULL DEFAULT 'US',
  state_code TEXT NOT NULL DEFAULT '',
  rate_bps INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS storefront_snapshots (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_products_merchant ON products (merchant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_merchant ON storefront_snapshots (merchant_id, published_at DESC);
