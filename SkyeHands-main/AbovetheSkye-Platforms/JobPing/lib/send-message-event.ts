import { MessageStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getMessagingProvider } from "@/lib/messaging";
import { appendTimelineEvent } from "@/lib/timeline";
import { getAccountAccess } from "@/lib/subscription";
import { assertLeadCanReceiveChannel } from "@/lib/consent";
import { reserveSmsAllowance, postReservedSmsUsage, releaseReservedSmsUsage } from "@/lib/usage";
import { assertAutomationRiskControls } from "@/lib/risk-controls";
import { maybeAutoPauseAfterFailedSend } from "@/lib/auto-pause";
import { maybeDeadLetterFailedMessage } from "@/lib/dead-letter";

const SENDABLE_STATUSES = [MessageStatus.queued, MessageStatus.scheduled] as const;

export async function sendMessageEventById(eventId: string) {
  const claim = await prisma.messageEvent.updateMany({
    where: {
      id: eventId,
      status: { in: [...SENDABLE_STATUSES] },
      OR: [{ scheduledFor: null }, { scheduledFor: { lte: new Date() } }],
    },
    data: { status: MessageStatus.retrying, lastAttemptAt: new Date() },
  });

  if (claim.count !== 1) {
    const current = await prisma.messageEvent.findUnique({ where: { id: eventId }, select: { id: true, status: true, scheduledFor: true } });
    return { ok: false as const, reason: "Event is not claimable for sending.", event: current };
  }

  const event = await prisma.messageEvent.findUnique({
    where: { id: eventId },
    include: { lead: true },
  });

  if (!event) return { ok: false as const, reason: "Message event not found after claim.", event: null };

  async function skip(reason: string, label: string, payload: Record<string, unknown> = {}, releaseReason = "released_after_send_block") {
    const updated = await prisma.messageEvent.update({
      where: { id: event.id },
      data: { status: MessageStatus.skipped, failureReason: reason, lastAttemptAt: new Date() },
    });
    if (event.channel === "sms") await releaseReservedSmsUsage(event.id, releaseReason);
    await appendTimelineEvent({
      accountId: event.accountId,
      leadId: event.leadId,
      eventType: "message.skipped",
      eventLabel: label,
      eventPayloadJson: { eventId: event.id, channel: event.channel, reason, ...payload },
    });
    return { ok: true as const, event: updated, skipped: true as const };
  }

  const consent = await assertLeadCanReceiveChannel({ accountId: event.accountId, leadId: event.leadId, channel: event.channel });
  if (!consent.allowed) return skip(consent.reason || "Lead cannot receive this channel.", "Message skipped because consent/contact rules blocked it", {}, "released_after_consent_block");

  const access = await getAccountAccess(event.accountId);
  if (!access.allowed) return skip(access.reason || "Subscription access is inactive.", "Message skipped because billing access is inactive", { subscriptionStatus: access.status }, "released_after_billing_block");

  if (event.channel === "sms") {
    const risk = await assertAutomationRiskControls({ accountId: event.accountId, leadId: event.leadId, channel: "sms", automated: true });
    if (!risk.allowed) return skip(risk.reason || "Automation risk control blocked send.", "Message skipped by automation safety controls", {}, "released_after_risk_control_block");

    const reservation = await reserveSmsAllowance({ accountId: event.accountId, leadId: event.leadId, messageEventId: event.id, body: event.bodySnapshot, automated: true, note: "reserved_before_provider_call" });
    if (!reservation.allowed) return skip(reservation.reason || "SMS fair-use guardrail blocked send.", "Message skipped by SMS fair-use guardrail before provider call", {}, "released_after_guardrail_block");
  }

  const destination = event.channel === "email" ? event.lead.email : event.lead.phone;
  if (!destination) return skip(`Lead has no ${event.channel === "email" ? "email" : "phone"} destination.`, "Message skipped because lead has no sendable destination");

  const provider = getMessagingProvider(event.channel);
  const result = await provider.send({
    accountId: event.accountId,
    leadId: event.leadId,
    channel: event.channel,
    to: destination,
    subject: event.subject,
    body: event.bodySnapshot,
  });

  const updated = await prisma.messageEvent.update({
    where: { id: event.id },
    data: result.success
      ? { status: MessageStatus.sent, providerMessageId: result.providerMessageId, sentAt: new Date(), lastAttemptAt: new Date(), failureReason: null }
      : { status: MessageStatus.failed, lastAttemptAt: new Date(), failureReason: result.errorMessage || result.errorCode || "Unknown send failure" },
  });

  if (event.channel === "sms") {
    if (result.success) await postReservedSmsUsage(event.id);
    else await releaseReservedSmsUsage(event.id, "released_after_provider_failure");
  }

  if (!result.success) {
    await maybeAutoPauseAfterFailedSend({ accountId: event.accountId, leadId: event.leadId, eventId: event.id, channel: event.channel });
    await maybeDeadLetterFailedMessage({ eventId: event.id, reason: result.errorMessage || result.errorCode || "Provider send failed" });
  }

  await appendTimelineEvent({
    accountId: event.accountId,
    leadId: event.leadId,
    eventType: result.success ? "message.sent" : "message.failed",
    eventLabel: result.success ? "Message sent" : "Message failed",
    eventPayloadJson: { eventId: event.id, channel: event.channel, providerMessageId: result.providerMessageId, failureReason: result.errorMessage, providerCode: result.errorCode },
  });

  return { ok: true as const, event: updated, sent: result.success };
}
