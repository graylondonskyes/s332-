CREATE TABLE IF NOT EXISTS route_plan_events (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  route_plan_id TEXT NOT NULL,
  stop_id TEXT NOT NULL,
  order_id TEXT DEFAULT '',
  return_pickup_id TEXT DEFAULT '',
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  proof_json TEXT DEFAULT '{}',
  actor TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (route_plan_id) REFERENCES route_plans(id) ON DELETE CASCADE,
  FOREIGN KEY (return_pickup_id) REFERENCES return_pickups(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_route_plan_events_plan_created ON route_plan_events(route_plan_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_route_plan_events_merchant_created ON route_plan_events(merchant_id, created_at DESC);
