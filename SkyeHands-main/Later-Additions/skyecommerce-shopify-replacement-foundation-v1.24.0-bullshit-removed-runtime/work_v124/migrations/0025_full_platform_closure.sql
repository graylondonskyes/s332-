CREATE TABLE IF NOT EXISTS warehouse_bins (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  zone TEXT DEFAULT '',
  aisle TEXT DEFAULT '',
  shelf TEXT DEFAULT '',
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (merchant_id, code)
);

CREATE TABLE IF NOT EXISTS warehouse_bin_inventory (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  bin_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  variant_id TEXT DEFAULT '',
  quantity INTEGER DEFAULT 0,
  reserved_quantity INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (merchant_id, bin_id, product_id, variant_id)
);

CREATE TABLE IF NOT EXISTS warehouse_pick_lists (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  work_order_id TEXT DEFAULT '',
  status TEXT DEFAULT 'open',
  lines_json TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS route_drivers (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS route_vehicles (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  driver_id TEXT DEFAULT '',
  label TEXT NOT NULL,
  capacity INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS route_plans (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  driver_id TEXT DEFAULT '',
  vehicle_id TEXT DEFAULT '',
  status TEXT DEFAULT 'planned',
  route_date TEXT NOT NULL,
  stops_json TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS return_pickups (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  return_id TEXT NOT NULL,
  driver_id TEXT DEFAULT '',
  status TEXT DEFAULT 'scheduled',
  pickup_window_start TEXT DEFAULT '',
  pickup_window_end TEXT DEFAULT '',
  address_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pos_terminal_payments (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  cart_id TEXT NOT NULL,
  order_id TEXT DEFAULT '',
  reader_id TEXT NOT NULL,
  provider_reference TEXT DEFAULT '',
  status TEXT DEFAULT 'processing',
  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'USD',
  payload_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pos_cash_drawer_events (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  register_id TEXT NOT NULL,
  shift_id TEXT DEFAULT '',
  event_type TEXT NOT NULL,
  amount_cents INTEGER DEFAULT 0,
  reason TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pos_receipt_print_jobs (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  order_id TEXT DEFAULT '',
  cart_id TEXT DEFAULT '',
  status TEXT DEFAULT 'queued',
  endpoint_url TEXT NOT NULL,
  result_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pos_endofday_reconciliations (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  business_date TEXT NOT NULL,
  report_json TEXT NOT NULL,
  status TEXT DEFAULT 'closed',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pos_offline_sync_events (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT DEFAULT 'accepted',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (merchant_id, device_id, sequence)
);

CREATE TABLE IF NOT EXISTS tax_filing_jobs (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  status TEXT DEFAULT 'submitted',
  payload_json TEXT NOT NULL,
  provider_result_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fraud_screening_jobs (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  status TEXT DEFAULT 'submitted',
  payload_json TEXT NOT NULL,
  provider_result_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pci_controls (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  control_key TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  evidence_url TEXT DEFAULT '',
  owner TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (merchant_id, control_key)
);

CREATE TABLE IF NOT EXISTS app_developer_accounts (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  payout_share_bps INTEGER DEFAULT 7000,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_review_submissions (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  app_id TEXT NOT NULL,
  developer_id TEXT NOT NULL,
  status TEXT DEFAULT 'submitted',
  checklist_json TEXT DEFAULT '{}',
  reviewer_notes TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_revenue_settlements (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  developer_id TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  gross_cents INTEGER DEFAULT 0,
  platform_fee_cents INTEGER DEFAULT 0,
  developer_payout_cents INTEGER DEFAULT 0,
  status TEXT DEFAULT 'open',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
