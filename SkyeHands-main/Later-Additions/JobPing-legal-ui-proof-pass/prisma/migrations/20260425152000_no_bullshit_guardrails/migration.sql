-- No-bullshit guardrails: public intake token, persistent rate limit, webhook idempotency.
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "publicIntakeTokenHash" TEXT;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "publicIntakeTokenLast4" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Account_publicIntakeTokenHash_key" ON "Account"("publicIntakeTokenHash") WHERE "publicIntakeTokenHash" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "RateLimitBucket" (
  "id" TEXT PRIMARY KEY,
  "bucketKey" TEXT NOT NULL UNIQUE,
  "count" INTEGER NOT NULL DEFAULT 0,
  "resetAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "BillingEvent_providerEventId_unique_not_null" ON "BillingEvent"("providerEventId") WHERE "providerEventId" IS NOT NULL;
