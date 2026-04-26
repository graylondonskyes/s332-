CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  order_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'received',
  payment_status TEXT NOT NULL DEFAULT 'pending_manual',
  currency TEXT NOT NULL DEFAULT 'USD',
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  shipping_address_json TEXT NOT NULL DEFAULT '{}',
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  shipping_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  items_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS import_jobs (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  source_ref TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'running',
  log_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ae_agents (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  territory TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ae_bookings (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  booking_date TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  contact_name TEXT NOT NULL DEFAULT '',
  contact_phone TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES ae_agents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ae_route_packets (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  route_date TEXT NOT NULL,
  packet_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES ae_agents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_orders_merchant ON orders (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_jobs_merchant ON import_jobs (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_agent ON ae_bookings (agent_id, booking_date ASC);
