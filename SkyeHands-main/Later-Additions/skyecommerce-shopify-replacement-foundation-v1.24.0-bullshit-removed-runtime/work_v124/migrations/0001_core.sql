CREATE TABLE IF NOT EXISTS merchants (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  brand_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  accent_color TEXT NOT NULL DEFAULT '#7c3aed',
  surface_color TEXT NOT NULL DEFAULT '#111827',
  background_color TEXT NOT NULL DEFAULT '#050816',
  text_color TEXT NOT NULL DEFAULT '#f8fafc',
  hero_title TEXT NOT NULL DEFAULT '',
  hero_tagline TEXT NOT NULL DEFAULT '',
  checkout_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  merchant_id TEXT,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at);
