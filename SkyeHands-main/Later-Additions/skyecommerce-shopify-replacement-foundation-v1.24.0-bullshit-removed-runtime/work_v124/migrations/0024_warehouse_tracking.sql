CREATE TABLE IF NOT EXISTS warehouse_work_orders (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  location_id TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'standard',
  status TEXT NOT NULL DEFAULT 'created',
  due_at TEXT NOT NULL DEFAULT '',
  external_ref TEXT NOT NULL DEFAULT '',
  http_status INTEGER NOT NULL DEFAULT 0,
  request_json TEXT NOT NULL DEFAULT '{}',
  response_json TEXT NOT NULL DEFAULT '{}',
  error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (location_id) REFERENCES inventory_locations(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS shipment_tracking_events (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  label_id TEXT,
  fulfillment_id TEXT,
  provider TEXT NOT NULL DEFAULT 'ups',
  tracking_number TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'in_transit',
  event_type TEXT NOT NULL DEFAULT '',
  event_time TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  raw_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (label_id) REFERENCES shipping_labels(id) ON DELETE SET NULL,
  FOREIGN KEY (fulfillment_id) REFERENCES fulfillments(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_warehouse_work_orders_merchant ON warehouse_work_orders (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_warehouse_work_orders_order ON warehouse_work_orders (merchant_id, order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipment_tracking_events_merchant ON shipment_tracking_events (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipment_tracking_events_tracking ON shipment_tracking_events (provider, tracking_number, event_time DESC);
