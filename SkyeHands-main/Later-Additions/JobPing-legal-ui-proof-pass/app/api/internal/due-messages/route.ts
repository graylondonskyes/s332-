import { MessageStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ok } from "@/lib/http";
import { assertInternalRequest } from "@/lib/internal-auth";
import { sendMessageEventById } from "@/lib/send-message-event";
import { acquireSchedulerLease, completeSchedulerLease } from "@/lib/scheduler-lock";

export async function POST(request: Request) {
  const denied = assertInternalRequest(request);
  if (denied) return denied;

  const lease = await acquireSchedulerLease("due-messages");
  if (!lease.acquired) return ok({ skipped: true, reason: lease.reason, activeRunId: lease.run.id });

  let scanned = 0;
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const results = [];

  try {
    const due = await prisma.messageEvent.findMany({
      where: {
        status: { in: [MessageStatus.queued, MessageStatus.scheduled] },
        OR: [{ scheduledFor: null }, { scheduledFor: { lte: new Date() } }],
      },
      orderBy: { createdAt: "asc" },
      take: 50,
      select: { id: true },
    });

    scanned = due.length;
    for (const event of due) {
      const result = await sendMessageEventById(event.id);
      const status = result.ok ? result.event.status : "not_claimed";
      if (result.ok && result.sent) sent += 1;
      else if (result.ok && result.skipped) skipped += 1;
      else if (result.ok && status === MessageStatus.failed) failed += 1;
      else skipped += 1;
      results.push({ eventId: event.id, ok: result.ok, status, reason: result.ok ? null : result.reason });
    }

    await completeSchedulerLease(lease.run.id, { scanned, sent, failed, skipped });
    return ok({ runId: lease.run.id, scanned, sent, failed, skipped, dispatched: results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown due-message dispatcher failure";
    await completeSchedulerLease(lease.run.id, { scanned, sent, failed, skipped, error: message });
    throw error;
  }
}
