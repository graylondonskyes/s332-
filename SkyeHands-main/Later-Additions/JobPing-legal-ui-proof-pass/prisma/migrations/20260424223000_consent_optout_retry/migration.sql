CREATE TYPE "ConsentStatus" AS ENUM ('unknown', 'granted', 'denied', 'revoked');
ALTER TYPE "MessageStatus" ADD VALUE IF NOT EXISTS 'retrying';
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "smsConsentStatus" "ConsentStatus" NOT NULL DEFAULT 'unknown';
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "emailConsentStatus" "ConsentStatus" NOT NULL DEFAULT 'unknown';
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "smsOptedOutAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "emailOptedOutAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "consentSource" TEXT;
ALTER TABLE "MessageEvent" ADD COLUMN IF NOT EXISTS "retryOfEventId" TEXT;
ALTER TABLE "MessageEvent" ADD COLUMN IF NOT EXISTS "retryCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MessageEvent" ADD COLUMN IF NOT EXISTS "lastAttemptAt" TIMESTAMP(3);
CREATE TABLE IF NOT EXISTS "ConsentRecord" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "leadId" TEXT,
  "channel" TEXT NOT NULL,
  "status" "ConsentStatus" NOT NULL,
  "source" TEXT NOT NULL,
  "reason" TEXT,
  "providerEventId" TEXT,
  "rawPayloadJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ConsentRecord_accountId_leadId_channel_createdAt_idx" ON "ConsentRecord"("accountId", "leadId", "channel", "createdAt");
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
