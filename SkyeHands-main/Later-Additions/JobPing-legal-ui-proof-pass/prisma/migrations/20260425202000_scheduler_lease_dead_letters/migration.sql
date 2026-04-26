CREATE TABLE IF NOT EXISTS "SchedulerRun" (
  "id" TEXT PRIMARY KEY,
  "accountId" TEXT,
  "jobName" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'running',
  "startedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "finishedAt" TIMESTAMPTZ,
  "scannedCount" INTEGER NOT NULL DEFAULT 0,
  "sentCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "skippedCount" INTEGER NOT NULL DEFAULT 0,
  "failureReason" TEXT,
  CONSTRAINT "SchedulerRun_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "SchedulerRun_jobName_status_startedAt_idx" ON "SchedulerRun"("jobName", "status", "startedAt");

CREATE TABLE IF NOT EXISTS "MessageDeadLetter" (
  "id" TEXT PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "leadId" TEXT,
  "messageEventId" TEXT NOT NULL UNIQUE,
  "reason" TEXT NOT NULL,
  "payloadJson" JSONB,
  "resolvedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "MessageDeadLetter_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "MessageDeadLetter_accountId_createdAt_idx" ON "MessageDeadLetter"("accountId", "createdAt");
