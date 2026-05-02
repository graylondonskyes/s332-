import { prisma } from "@/lib/db";
import { verifyTwilioRequest, formDataToRecord } from "@/lib/messaging/twilio-webhook";
import { ok, unauthorized } from "@/lib/http";
import { classifySmsConsentKeyword, normalizePhone, recordSmsOptIn, recordSmsOptOut } from "@/lib/consent";

export async function POST(request: Request) {
  const form = await request.formData();
  const params = formDataToRecord(form);
  const signatureCheck = verifyTwilioRequest({ url: request.url, params, signature: request.headers.get("x-twilio-signature"), authToken: process.env.TWILIO_AUTH_TOKEN });
  if (!signatureCheck.ok) return unauthorized(signatureCheck.reason || "Invalid Twilio webhook signature.");

  const from = normalizePhone(String(form.get("From") || ""));
  const to = normalizePhone(String(form.get("To") || ""));
  const body = String(form.get("Body") || "");
  const messageSid = String(form.get("MessageSid") || form.get("SmsSid") || "");
  const account = to ? await prisma.account.findFirst({ where: { businessPhone: to } }) : null;
  const keyword = classifySmsConsentKeyword(body);

  await prisma.ingestEvent.create({
    data: { accountId: account?.id, rawType: "twilio.inbound_sms", provider: "twilio", providerEventId: messageSid || null, rawPayloadJson: params, normalized: Boolean(account && from && keyword) },
  });

  if (!account || !from) return ok({ received: true, normalized: false, reason: !account ? "account_not_found" : "missing_from" });
  if (keyword === "stop") {
    const result = await recordSmsOptOut({ accountId: account.id, phone: from, providerEventId: messageSid, rawPayloadJson: params });
    return ok({ received: true, normalized: true, consent: "revoked", updatedLeads: result.updated });
  }
  if (keyword === "start") {
    const result = await recordSmsOptIn({ accountId: account.id, phone: from, providerEventId: messageSid, rawPayloadJson: params });
    return ok({ received: true, normalized: true, consent: "granted", updatedLeads: result.updated });
  }
  return ok({ received: true, normalized: false, reason: "not_a_consent_keyword" });
}
