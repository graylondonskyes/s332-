ALTER TABLE "UsageLedger" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'posted';
ALTER TABLE "UsageLedger" ADD COLUMN IF NOT EXISTS "reservationKey" TEXT;
ALTER TABLE "UsageLedger" ADD COLUMN IF NOT EXISTS "postedAt" TIMESTAMPTZ;
ALTER TABLE "UsageLedger" ADD COLUMN IF NOT EXISTS "releasedAt" TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS "UsageLedger_reservationKey_key" ON "UsageLedger"("reservationKey");
CREATE INDEX IF NOT EXISTS "UsageLedger_accountId_usageType_periodKey_status_idx" ON "UsageLedger"("accountId", "usageType", "periodKey", "status");
UPDATE "UsageLedger" SET "status" = 'posted', "postedAt" = COALESCE("postedAt", "createdAt") WHERE "status" IS NULL OR "status" = '';
