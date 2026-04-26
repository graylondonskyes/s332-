import { prisma } from "@/lib/db";
import { verifyTwilioRequest, formDataToRecord } from "@/lib/messaging/twilio-webhook";
import { badRequest, ok, unauthorized } from "@/lib/http";
import { dispatchAutomationForLead } from "@/lib/automation";
import { appendTimelineEvent } from "@/lib/timeline";
import { normalizePhone } from "@/lib/consent";


export async function POST(request: Request) {
  const form = await request.formData();
  const params = formDataToRecord(form);
  const signatureCheck = verifyTwilioRequest({ url: request.url, params, signature: request.headers.get("x-twilio-signature"), authToken: process.env.TWILIO_AUTH_TOKEN });
  if (!signatureCheck.ok) return unauthorized(signatureCheck.reason || "Invalid Twilio webhook signature.");

  const from = normalizePhone(String(form.get("From") || ""));
  const to = normalizePhone(String(form.get("To") || ""));
  const callStatus = String(form.get("CallStatus") || "");
  const callSid = String(form.get("CallSid") || "");

  const account = to ? await prisma.account.findFirst({ where: { businessPhone: to } }) : null;
  const ingest = await prisma.ingestEvent.create({
    data: {
      accountId: account?.id,
      rawType: "twilio.missed_call",
      provider: "twilio",
      providerEventId: callSid || null,
      rawPayloadJson: params,
      normalized: false,
    },
  });

  if (!account) return badRequest("No JobPing account matched the Twilio To number. Set account.businessPhone to the Twilio receiving number.");
  if (!from) return badRequest("Twilio call event is missing a From number.");

  const lead = await prisma.lead.create({
    data: {
      accountId: account.id,
      firstName: "Missed",
      lastName: "Caller",
      phone: from,
      serviceType: "Missed call follow-up",
      source: "twilio_missed_call",
      notes: `Missed-call event received from Twilio. CallStatus=${callStatus || "unknown"}.`,
      smsConsentStatus: "granted",
      consentSource: "twilio_missed_call",
    },
  });

  await prisma.ingestEvent.update({ where: { id: ingest.id }, data: { normalized: true, createdLeadId: lead.id } });
  await appendTimelineEvent({ accountId: account.id, leadId: lead.id, eventType: "lead.created", eventLabel: "Lead created from missed-call webhook", eventPayloadJson: { callSid, callStatus, from, to } });
  await dispatchAutomationForLead({ accountId: account.id, leadId: lead.id, triggerEvent: "lead.created" });

  return ok({ received: true, normalized: true, leadId: lead.id });
}
