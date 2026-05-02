import { MessageStatus } from "@prisma/client";
import { dispatchAutomationForLead } from "@/lib/automation";
import { badRequest, ok } from "@/lib/http";
import { assertInternalRequest } from "@/lib/internal-auth";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const denied = assertInternalRequest(request);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));

  if (body.accountId && body.leadId && body.triggerEvent) {
    await dispatchAutomationForLead({ accountId: body.accountId, leadId: body.leadId, triggerEvent: body.triggerEvent });
    return ok({ ok: true, mode: "trigger", leadId: body.leadId });
  }

  const limit = Math.min(Number(body.limit || 25), 100);
  const due = await prisma.messageEvent.findMany({
    where: {
      status: { in: [MessageStatus.queued, MessageStatus.scheduled] },
      OR: [{ scheduledFor: null }, { scheduledFor: { lte: new Date() } }],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  return ok({
    ok: true,
    mode: "due-message-scan",
    dueCount: due.length,
    eventIds: due.map((event) => event.id),
    note: "Send each returned eventId through /api/internal/send-message with the same x-jobping-internal-secret header.",
  });
}
