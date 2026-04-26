CREATE TABLE IF NOT EXISTS inventory_locations (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
  UNIQUE (merchant_id, code)
);

CREATE TABLE IF NOT EXISTS inventory_levels (
  location_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  available INTEGER NOT NULL DEFAULT 0,
  reserved INTEGER NOT NULL DEFAULT 0,
  inbound INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (location_id, product_id),
  FOREIGN KEY (location_id) REFERENCES inventory_locations(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'correction',
  delta INTEGER NOT NULL DEFAULT 0,
  before_available INTEGER NOT NULL DEFAULT 0,
  after_available INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  reference TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
  FOREIGN KEY (location_id) REFERENCES inventory_locations(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS order_allocations (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  location_id TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (location_id) REFERENCES inventory_locations(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_inventory_locations_merchant ON inventory_locations (merchant_id, priority ASC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_inventory_levels_product ON inventory_levels (product_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_merchant ON inventory_adjustments (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_allocations_order ON order_allocations (order_id, created_at ASC);
