-- Idempotency hardening: prevent duplicate automation queue records and duplicate webhook processing.
ALTER TABLE "MessageEvent" ADD COLUMN IF NOT EXISTS "queueKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "MessageEvent_queueKey_key" ON "MessageEvent"("queueKey");
CREATE INDEX IF NOT EXISTS "MessageEvent_accountId_ruleId_status_idx" ON "MessageEvent"("accountId", "ruleId", "status");

-- Provider event ids are nullable; Postgres permits multiple nulls while blocking duplicate non-null ids.
CREATE UNIQUE INDEX IF NOT EXISTS "BillingEvent_providerEventId_key" ON "BillingEvent"("providerEventId");
CREATE UNIQUE INDEX IF NOT EXISTS "IngestEvent_provider_raw_type_event_key" ON "IngestEvent"("provider", "rawType", "providerEventId");
