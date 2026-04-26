import { MessageStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

const DEAD_LETTER_AFTER_RETRIES = 3;

export async function maybeDeadLetterFailedMessage(input: { eventId: string; reason?: string | null }) {
  const event = await prisma.messageEvent.findUnique({ where: { id: input.eventId } });
  if (!event || event.status !== MessageStatus.failed) return null;
  if (event.retryCount < DEAD_LETTER_AFTER_RETRIES) return null;

  const existing = await prisma.messageDeadLetter.findUnique({ where: { messageEventId: event.id } }).catch(() => null);
  if (existing) return existing;

  return prisma.messageDeadLetter.create({
    data: {
      accountId: event.accountId,
      leadId: event.leadId,
      messageEventId: event.id,
      reason: input.reason || event.failureReason || "Message exceeded retry limit.",
      payloadJson: {
        channel: event.channel,
        status: event.status,
        retryCount: event.retryCount,
        providerMessageId: event.providerMessageId,
        failureReason: event.failureReason,
      },
    },
  });
}
