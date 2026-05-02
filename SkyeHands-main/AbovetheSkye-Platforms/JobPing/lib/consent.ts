import { ConsentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { appendTimelineEvent } from "@/lib/timeline";
import { releaseReservedSmsUsageForLead } from "@/lib/usage";

export const STOP_WORDS = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"]);
export const START_WORDS = new Set(["START", "UNSTOP", "YES"]);

export function normalizePhone(value?: string | null) {
  if (!value) return null;
  const stripped = value.replace(/[^+\d]/g, "");
  if (!stripped) return null;
  return stripped.startsWith("+") ? stripped : `+${stripped}`;
}

export function classifySmsConsentKeyword(body?: string | null) {
  const token = String(body || "").trim().split(/\s+/)[0]?.toUpperCase();
  if (STOP_WORDS.has(token)) return "stop" as const;
  if (START_WORDS.has(token)) return "start" as const;
  return null;
}

export async function assertLeadCanReceiveChannel(input: { leadId: string; accountId: string; channel: string }) {
  const lead = await prisma.lead.findFirst({ where: { id: input.leadId, accountId: input.accountId } });
  if (!lead) return { allowed: false, reason: "Lead not found for account." };

  if (input.channel === "sms") {
    if (!lead.phone) return { allowed: false, reason: "Lead has no phone number." };
    if (lead.smsConsentStatus === ConsentStatus.revoked || lead.smsConsentStatus === ConsentStatus.denied || lead.smsOptedOutAt) {
      return { allowed: false, reason: "Lead has opted out of SMS messages." };
    }
  }

  if (input.channel === "email") {
    if (!lead.email) return { allowed: false, reason: "Lead has no email address." };
    if (lead.emailConsentStatus === ConsentStatus.revoked || lead.emailConsentStatus === ConsentStatus.denied || lead.emailOptedOutAt) {
      return { allowed: false, reason: "Lead has opted out of email messages." };
    }
  }

  return { allowed: true, reason: null };
}

export async function recordSmsOptOut(input: {
  accountId: string;
  phone: string;
  providerEventId?: string | null;
  rawPayloadJson?: Record<string, unknown>;
  reason?: string;
}) {
  const phone = normalizePhone(input.phone);
  if (!phone) return { updated: 0 };
  const leads = await prisma.lead.findMany({ where: { accountId: input.accountId, phone } });
  let updated = 0;
  for (const lead of leads) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { smsConsentStatus: ConsentStatus.revoked, smsOptedOutAt: new Date(), consentSource: "twilio_inbound_sms" },
    });
    await prisma.consentRecord.create({
      data: {
        accountId: input.accountId,
        leadId: lead.id,
        channel: "sms",
        status: ConsentStatus.revoked,
        source: "twilio_inbound_sms",
        reason: input.reason || "SMS STOP keyword received.",
        providerEventId: input.providerEventId || null,
        rawPayloadJson: input.rawPayloadJson || undefined,
      },
    });
    await prisma.messageEvent.updateMany({
      where: { accountId: input.accountId, leadId: lead.id, channel: "sms", status: { in: ["queued", "scheduled", "retrying"] } },
      data: { status: "canceled", failureReason: "Canceled because lead opted out of SMS." },
    });
    await releaseReservedSmsUsageForLead({ accountId: input.accountId, leadId: lead.id, reason: "released_after_sms_opt_out" });
    await appendTimelineEvent({
      accountId: input.accountId,
      leadId: lead.id,
      eventType: "consent.revoked",
      eventLabel: "SMS opt-out recorded; pending SMS sends canceled",
      eventPayloadJson: { phone, providerEventId: input.providerEventId || null },
    });
    updated++;
  }
  return { updated };
}

export async function recordSmsOptIn(input: {
  accountId: string;
  phone: string;
  providerEventId?: string | null;
  rawPayloadJson?: Record<string, unknown>;
}) {
  const phone = normalizePhone(input.phone);
  if (!phone) return { updated: 0 };
  const leads = await prisma.lead.findMany({ where: { accountId: input.accountId, phone } });
  let updated = 0;
  for (const lead of leads) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { smsConsentStatus: ConsentStatus.granted, smsOptedOutAt: null, consentSource: "twilio_inbound_sms" },
    });
    await prisma.consentRecord.create({
      data: {
        accountId: input.accountId,
        leadId: lead.id,
        channel: "sms",
        status: ConsentStatus.granted,
        source: "twilio_inbound_sms",
        reason: "SMS START keyword received.",
        providerEventId: input.providerEventId || null,
        rawPayloadJson: input.rawPayloadJson || undefined,
      },
    });
    await appendTimelineEvent({ accountId: input.accountId, leadId: lead.id, eventType: "consent.granted", eventLabel: "SMS opt-in recorded", eventPayloadJson: { phone } });
    updated++;
  }
  return { updated };
}
