-- v1.10.0 queue + webhook truth-hardening.
-- Removes non-live queue success and stores retrievable encrypted webhook secrets for real signed delivery retries.
ALTER TABLE webhook_endpoints ADD COLUMN secret_cipher_json TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_notification_messages_due_queue ON notification_messages (merchant_id, status, next_attempt_at, created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_due_queue ON webhook_deliveries (merchant_id, status, next_attempt_at, created_at);
