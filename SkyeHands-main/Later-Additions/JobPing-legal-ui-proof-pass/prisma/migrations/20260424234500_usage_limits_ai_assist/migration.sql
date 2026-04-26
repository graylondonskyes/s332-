ALTER TYPE "TemplateType" ADD VALUE IF NOT EXISTS 'ai_rewrite_prompt';
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "includedSmsSegments" INTEGER NOT NULL DEFAULT 500;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "smsOverageEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "smsOverageCents" INTEGER NOT NULL DEFAULT 4;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "hardStopAtLimit" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "maxAutomatedSmsPerLead" INTEGER NOT NULL DEFAULT 4;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "includedAiActions" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "aiOverageEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "UsageLedger" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "leadId" TEXT,
  "messageEventId" TEXT,
  "usageType" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "billable" BOOLEAN NOT NULL DEFAULT false,
  "unitCostCents" INTEGER,
  "periodKey" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UsageLedger_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "UsageLedger_accountId_usageType_periodKey_idx" ON "UsageLedger"("accountId", "usageType", "periodKey");
ALTER TABLE "UsageLedger" ADD CONSTRAINT "UsageLedger_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "AiEvent" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "leadId" TEXT,
  "actionType" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "inputSnapshot" TEXT,
  "outputSnapshot" TEXT,
  "provider" TEXT,
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AiEvent_accountId_actionType_createdAt_idx" ON "AiEvent"("accountId", "actionType", "createdAt");
ALTER TABLE "AiEvent" ADD CONSTRAINT "AiEvent_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiEvent" ADD CONSTRAINT "AiEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
