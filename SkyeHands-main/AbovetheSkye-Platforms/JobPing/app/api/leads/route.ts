import { prisma } from "@/lib/db";
import { requireAccountUser } from "@/lib/auth";
import { badRequest, created, ok } from "@/lib/http";
import { leadCreateSchema } from "@/lib/validators";
import { appendTimelineEvent } from "@/lib/timeline";
import { dispatchAutomationForLead } from "@/lib/automation";
import { normalizePhone } from "@/lib/consent";

export async function GET() {
  const user = await requireAccountUser();
  const leads = await prisma.lead.findMany({ where: { accountId: user.accountId! }, orderBy: { createdAt: "desc" } });
  return ok(leads);
}

export async function POST(request: Request) {
  const user = await requireAccountUser();
  const body = await request.json();
  const parsed = leadCreateSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid lead payload", parsed.error.flatten());

  const lead = await prisma.lead.create({
    data: {
      accountId: user.accountId!,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      phone: normalizePhone(parsed.data.phone),
      email: parsed.data.email || undefined,
      serviceType: parsed.data.serviceType,
      source: parsed.data.source,
      notes: parsed.data.notes,
      smsConsentStatus: parsed.data.smsConsent ? "granted" : "unknown",
      emailConsentStatus: parsed.data.emailConsent ? "granted" : "unknown",
      consentSource: parsed.data.smsConsent || parsed.data.emailConsent ? "manual_lead_entry_explicit" : "manual_lead_entry_no_consent",
    },
  });

  if (parsed.data.smsConsent) {
    await prisma.consentRecord.create({ data: { accountId: user.accountId!, leadId: lead.id, channel: "sms", status: "granted", source: "manual_lead_entry", reason: "Owner recorded explicit SMS consent." } });
  }
  if (parsed.data.emailConsent) {
    await prisma.consentRecord.create({ data: { accountId: user.accountId!, leadId: lead.id, channel: "email", status: "granted", source: "manual_lead_entry", reason: "Owner recorded explicit email consent." } });
  }

  await appendTimelineEvent({
    accountId: user.accountId!,
    leadId: lead.id,
    eventType: "lead.created",
    eventLabel: "Lead created",
    createdByUserId: user.id,
    eventPayloadJson: { source: parsed.data.source || "manual" },
  });

  await dispatchAutomationForLead({ accountId: user.accountId!, leadId: lead.id, triggerEvent: "lead.created" });

  return created(lead);
}
