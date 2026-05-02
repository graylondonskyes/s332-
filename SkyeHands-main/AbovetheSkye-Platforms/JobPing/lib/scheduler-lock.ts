import { prisma } from "@/lib/db";

const DEFAULT_STALE_AFTER_MS = 1000 * 60 * 10;

export async function acquireSchedulerLease(jobName: string, staleAfterMs = DEFAULT_STALE_AFTER_MS) {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - staleAfterMs);
  const existing = await prisma.schedulerRun.findFirst({
    where: { jobName, status: "running", startedAt: { gt: staleBefore } },
    orderBy: { startedAt: "desc" },
  });

  if (existing) return { acquired: false as const, run: existing, reason: "scheduler_already_running" };

  const run = await prisma.schedulerRun.create({ data: { jobName, status: "running", startedAt: now } });
  return { acquired: true as const, run, reason: null };
}

export async function completeSchedulerLease(runId: string, result: { scanned: number; sent: number; failed: number; skipped: number; error?: string | null }) {
  return prisma.schedulerRun.update({
    where: { id: runId },
    data: {
      status: result.error ? "failed" : "completed",
      finishedAt: new Date(),
      scannedCount: result.scanned,
      sentCount: result.sent,
      failedCount: result.failed,
      skippedCount: result.skipped,
      failureReason: result.error || null,
    },
  });
}

export async function getSchedulerHealth(jobName = "due-messages") {
  const [lastRun, stuckRuns] = await Promise.all([
    prisma.schedulerRun.findFirst({ where: { jobName }, orderBy: { startedAt: "desc" } }),
    prisma.schedulerRun.findMany({
      where: { jobName, status: "running", startedAt: { lt: new Date(Date.now() - DEFAULT_STALE_AFTER_MS) } },
      orderBy: { startedAt: "desc" },
      take: 10,
    }),
  ]);
  return { jobName, lastRun, stuckRuns, healthy: Boolean(lastRun) && stuckRuns.length === 0 && lastRun.status !== "failed" };
}
