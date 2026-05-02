import { MessageStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAccountUser } from "@/lib/auth";
import { assertAccountMatch } from "@/lib/permissions";
import { badRequest, created } from "@/lib/http";
import { appendTimelineEvent } from "@/lib/timeline";
import { assertLeadCanReceiveChannel } from "@/lib/consent";
import { getAccountAccess } from "@/lib/subscription";

const MAX_RETRY_COUNT = 3;

export async function POST(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const user = await requireAccountUser();
  const { eventId } = await params;
  const event = await prisma.messageEvent.findUnique({ where: { id: eventId } });
  if (!event) return badRequest("Message event not found.");
  assertAccountMatch(user.accountId, event.accountId);

  if (![MessageStatus.failed, MessageStatus.skipped].includes(event.status)) return badRequest("Only failed or skipped messages can be retried.");
  if (event.retryCount >= MAX_RETRY_COUNT) return badRequest(`Retry limit reached (${MAX_RETRY_COUNT}).`);

  const access = await getAccountAccess(event.accountId);
  if (!access.allowed) return badRequest(access.reason || "Subscription is inactive; retry is blocked.");

  const consent = await assertLeadCanReceiveChannel({ accountId: event.accountId, leadId: event.leadId, channel: event.channel });
  if (!consent.allowed) return badRequest(consent.reason || "Lead cannot receive this channel; retry is blocked.");

  const retry = await prisma.messageEvent.create({
    data: {
      accountId: event.accountId,
      leadId: event.leadId,
      templateId: event.templateId,
      ruleId: event.ruleId,
      channel: event.channel,
      direction: event.direction,
      status: MessageStatus.queued,
      subject: event.subject,
      bodySnapshot: event.bodySnapshot,
      retryOfEventId: event.id,
      retryCount: event.retryCount + 1,
    },
  });
  await appendTimelineEvent({ accountId: event.accountId, leadId: event.leadId, eventType: "message.retry_queued", eventLabel: "Message retry queued", createdByUserId: user.id, eventPayloadJson: { originalEventId: event.id, retryEventId: retry.id, retryCount: retry.retryCount } });
  return created(retry);
}
