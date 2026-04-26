-- v1.8.0 real-system hardening layer.
-- Adds staff login credentials, stricter session actor metadata, and queue lifecycle fields.
ALTER TABLE staff_members ADD COLUMN password_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE sessions ADD COLUMN actor_ref TEXT NOT NULL DEFAULT '';
ALTER TABLE notification_messages ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE notification_messages ADD COLUMN last_error TEXT NOT NULL DEFAULT '';
ALTER TABLE notification_messages ADD COLUMN next_attempt_at TEXT;
ALTER TABLE notification_messages ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE webhook_deliveries ADD COLUMN next_attempt_at TEXT;
ALTER TABLE webhook_deliveries ADD COLUMN locked_at TEXT;
CREATE INDEX IF NOT EXISTS idx_staff_members_login ON staff_members (merchant_id, email, status);
CREATE INDEX IF NOT EXISTS idx_notifications_queue ON notification_messages (merchant_id, status, next_attempt_at, created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_queue ON webhook_deliveries (merchant_id, status, next_attempt_at, created_at);
