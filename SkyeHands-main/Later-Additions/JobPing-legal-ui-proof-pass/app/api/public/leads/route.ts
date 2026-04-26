import { prisma } from "@/lib/db";
import { badRequest, created, unauthorized } from "@/lib/http";
import { normalizePhone } from "@/lib/consent";
import { appendTimelineEvent } from "@/lib/timeline";
import { dispatchAutomationForLead } from "@/lib/automation";
import { resolveAccountByIntakeToken } from "@/lib/intake-token";
import { persistentFixedWindowRateLimit } from "@/lib/db-rate-limit";
import { audit } from "@/lib/admin";

async function readBody(request: Request) {
  const type = request.headers.get("content-type") || "";
  if (type.includes("application/json")) return request.json();
  const form = await request.formData();
  return Object.fromEntries(form.entries());
}

export async function POST(request: Request) {
  const body = await readBody(request);
  const rawToken = String(body.intakeToken || "").trim();
  if (!rawToken) return unauthorized("Lead form token is required.");

  const account = await resolveAccountByIntakeToken(rawToken);
  if (!account) return unauthorized("Lead form token is invalid or has been rotated.");
  if (!["trial", "active"].includes(account.subscription?.status || "")) return badRequest("Lead form is temporarily unavailable.");

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limited = await persistentFixedWindowRateLimit({ bucketKey: `public-lead:${account.id}:${ip}`, max: 12, windowMs: 60_000 });
  if (!limited.allowed) return badRequest("Too many lead submissions. Try again shortly.");

  const phone = normalizePhone(String(body.phone || ""));
  const email = String(body.email || "").trim().toLowerCase();
  if (!phone && !email) return badRequest("Phone or email is required.");
  if (phone && !body.smsConsent) return badRequest("SMS consent is required before text follow-up can be sent.");

  const duplicate = await prisma.lead.findFirst({
    where: {
      accountId: account.id,
      OR: [{ phone: phone || undefined }, { email: email || undefined }].filter(Boolean) as any,
    },
    orderBy: { createdAt: "desc" },
  });

  const lead = await prisma.lead.create({
    data: {
      accountId: account.id,
      firstName: String(body.firstName || "").slice(0, 80),
      lastName: String(body.lastName || "").slice(0, 80),
      phone: phone || undefined,
      email: email || undefined,
      serviceType: String(body.serviceType || "").slice(0, 120),
      source: "public_embed",
      notes: String(body.notes || "").slice(0, 2000),
      smsConsentStatus: body.smsConsent ? "granted" : "unknown",
      emailConsentStatus: email ? "granted" : "unknown",
      consentSource: "public_embed_form",
    },
  });

  await prisma.consentRecord.create({ data: { accountId: account.id, leadId: lead.id, channel: "sms", status: body.smsConsent ? "granted" : "unknown", source: "public_embed_form", reason: "Lead submitted through embedded form with explicit checkbox consent." } });
  await appendTimelineEvent({ accountId: account.id, leadId: lead.id, eventType: duplicate ? "lead.duplicate_created" : "lead.created", eventLabel: duplicate ? "Possible duplicate lead created" : "Public lead created", eventPayloadJson: { source: "public_embed", duplicateLeadId: duplicate?.id, tokenLast4: account.publicIntakeTokenLast4 } });
  await audit({ accountId: account.id, action: duplicate ? "public_duplicate_lead_created" : "public_lead_created", details: { leadId: lead.id, duplicateLeadId: duplicate?.id, ipLimitedResetAt: limited.resetAt } });
  await dispatchAutomationForLead({ accountId: account.id, leadId: lead.id, triggerEvent: "lead.created" });
  return created({ ok: true, leadId: lead.id });
}
