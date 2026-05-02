import { MessageStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { appendTimelineEvent } from "@/lib/timeline";

export async function maybeAutoPauseAfterFailedSend(input: { accountId: string; leadId: string; eventId: string; channel: string }) {
  const settings = await prisma.settings.findUnique({ where: { accountId: input.accountId } });
  if (!settings?.autoPauseFailedSends) return { paused: false, reason: "auto_pause_disabled" };

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const failedCount = await prisma.messageEvent.count({
    where: {
      accountId: input.accountId,
      channel: input.channel,
      direction: "outbound",
      status: MessageStatus.failed,
      lastAttemptAt: { gte: since },
    },
  });

  if (failedCount < 5) return { paused: false, reason: "threshold_not_met", failedCount };

  await prisma.automationRule.updateMany({
    where: {
      accountId: input.accountId,
      isEnabled: true,
      template: { channel: input.channel },
    },
    data: { isEnabled: false, updatedAt: new Date() },
  });

  await appendTimelineEvent({
    accountId: input.accountId,
    leadId: input.leadId,
    eventType: "automation.auto_paused",
    eventLabel: `${input.channel.toUpperCase()} automations auto-paused after repeated failed sends`,
    eventPayloadJson: { eventId: input.eventId, failedCount, windowHours: 24 },
  });

  return { paused: true, failedCount };
}
