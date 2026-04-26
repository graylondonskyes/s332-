import { MessageStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { verifyTwilioRequest, formDataToRecord } from "@/lib/messaging/twilio-webhook";
import { ok, unauthorized } from "@/lib/http";
import { appendTimelineEvent } from "@/lib/timeline";

function statusFromTwilio(status?: string | null) {
  if (["delivered", "read"].includes(String(status))) return MessageStatus.delivered;
  if (["failed", "undelivered"].includes(String(status))) return MessageStatus.failed;
  if (["sent", "queued", "accepted", "sending"].includes(String(status))) return MessageStatus.sent;
  return null;
}

const STATUS_RANK: Record<string, number> = {
  queued: 1,
  scheduled: 1,
  retrying: 2,
  sent: 3,
  delivered: 4,
  failed: 5,
  skipped: 5,
  canceled: 5,
};

function shouldApplyStatus(current: MessageStatus, next: MessageStatus) {
  if (current === MessageStatus.delivered && next === MessageStatus.sent) return false;
  if (current === MessageStatus.failed && next === MessageStatus.sent) return false;
  return (STATUS_RANK[next] || 0) >= (STATUS_RANK[current] || 0);
}

export async function POST(request: Request) {
  const form = await request.formData();
  const params = formDataToRecord(form);
  const signatureCheck = verifyTwilioRequest({ url: request.url, params, signature: request.headers.get("x-twilio-signature"), authToken: process.env.TWILIO_AUTH_TOKEN });
  if (!signatureCheck.ok) return unauthorized(signatureCheck.reason || "Invalid Twilio webhook signature.");

  const providerMessageId = String(form.get("MessageSid") || form.get("SmsSid") || "");
  const messageStatus = String(form.get("MessageStatus") || form.get("SmsStatus") || "");
  const errorCode = form.get("ErrorCode") ? String(form.get("ErrorCode")) : null;
  const mapped = statusFromTwilio(messageStatus);
  const providerEventId = providerMessageId ? `${providerMessageId}:${messageStatus}:${errorCode || "none"}` : null;

  try {
    await prisma.ingestEvent.create({
      data: {
        rawType: "twilio.message_status",
        provider: "twilio",
        providerEventId,
        rawPayloadJson: params,
        normalized: Boolean(providerMessageId && mapped),
      },
    });
  } catch (error: any) {
    if (error?.code === "P2002") return ok({ received: true, duplicate: true, providerEventId });
    throw error;
  }

  if (!providerMessageId || !mapped) return ok({ received: true, normalized: false });

  const event = await prisma.messageEvent.findFirst({ where: { providerMessageId } });
  if (!event) return ok({ received: true, normalized: false, reason: "message_event_not_found" });

  if (!shouldApplyStatus(event.status, mapped)) {
    return ok({ received: true, normalized: true, ignored: true, reason: "stale_status_update", currentStatus: event.status, incomingStatus: mapped });
  }

  const updated = await prisma.messageEvent.update({
    where: { id: event.id },
    data: {
      status: mapped,
      deliveredAt: mapped === MessageStatus.delivered ? new Date() : event.deliveredAt,
      failureReason: mapped === MessageStatus.failed ? `Twilio delivery failed${errorCode ? `: ${errorCode}` : ""}` : event.failureReason,
    },
  });

  await appendTimelineEvent({
    accountId: updated.accountId,
    leadId: updated.leadId,
    eventType: mapped === MessageStatus.delivered ? "message.delivered" : mapped === MessageStatus.failed ? "message.failed" : "message.sent",
    eventLabel: `Twilio status update: ${messageStatus}`,
    eventPayloadJson: { providerMessageId, messageStatus, errorCode, providerEventId },
  });

  return ok({ received: true, normalized: true, messageEventId: updated.id });
}
