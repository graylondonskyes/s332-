import bcrypt from "bcryptjs";
import { PrismaClient, TemplateType, SubscriptionStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 10);

  const account = await prisma.account.upsert({
    where: { id: "seed_account_jobping" },
    update: {},
    create: {
      id: "seed_account_jobping",
      businessName: "Desert Peak Plumbing",
      niche: "plumbing",
      businessPhone: "+14805550100",
      replyEmail: "owner@jobping.local",
      reviewUrl: "https://reviews.internal.invalid/review",
      serviceArea: "Phoenix Metro",
      onboardingCompleted: true,
    },
  });

  await prisma.user.upsert({
    where: { email: "owner@jobping.local" },
    update: {
      passwordHash,
      accountId: account.id,
      fullName: "Owner User",
    },
    create: {
      email: "owner@jobping.local",
      passwordHash,
      accountId: account.id,
      fullName: "Owner User",
    },
  });

  await prisma.subscription.upsert({
    where: { accountId: account.id },
    update: {
      status: SubscriptionStatus.trial,
      provider: "manual",
      planName: "starter",
    },
    create: {
      accountId: account.id,
      provider: "manual",
      planName: "starter",
      status: SubscriptionStatus.trial,
    },
  });

  await prisma.settings.upsert({
    where: { accountId: account.id },
    update: {
      defaultFromName: "Desert Peak Plumbing",
      defaultReplyEmail: "owner@jobping.local",
      notificationEmail: "owner@jobping.local",
    },
    create: {
      accountId: account.id,
      defaultFromName: "Desert Peak Plumbing",
      defaultReplyEmail: "owner@jobping.local",
      notificationEmail: "owner@jobping.local",
    },
  });

  const templates: Record<TemplateType, string> = {
    welcome_reply: "Hi {{first_name}}, thanks for reaching out to {{business_name}} about {{service_type}}. We got your request and will follow up shortly.",
    missed_call_reply: "Sorry we missed your call. This is {{business_name}}. Reply here and we can help with {{service_type}}.",
    followup_1: "Hi {{first_name}}, checking in from {{business_name}}. Do you still need help with {{service_type}}?",
    followup_2: "Just following up one more time about {{service_type}}. Reply here if you want a fast quote from {{business_name}}.",
    quote_followup: "Hi {{first_name}}, following up on your quote request with {{business_name}}. Let us know if you want to move forward.",
    review_request: "Thanks for choosing {{business_name}}. If we helped you today, would you mind leaving a review here? {{review_url}}",
    ai_rewrite_prompt: "Rewrite this JobPing customer message so it stays clear, local, polite, and honest: {{service_type}}",
  };

  for (const [templateType, body] of Object.entries(templates) as [TemplateType, string][]) {
    const template = await prisma.messageTemplate.upsert({
      where: { accountId_templateType: { accountId: account.id, templateType } },
      update: { body, isEnabled: true, name: templateType.replaceAll("_", " ") },
      create: {
        accountId: account.id,
        templateType,
        name: templateType.replaceAll("_", " "),
        body,
        channel: "sms",
        isEnabled: true,
      },
    });

    const triggerEvent = templateType === "review_request" ? "lead.completed" : "lead.created";
    const delayMinutes = templateType === "followup_1" ? 1440 : templateType === "followup_2" ? 2880 : 0;
    const sequenceOrder = templateType === "welcome_reply" ? 0 : templateType === "followup_1" ? 1 : templateType === "followup_2" ? 2 : 0;

    await prisma.automationRule.upsert({
      where: { id: `${account.id}_${templateType}` },
      update: {
        templateId: template.id,
        triggerEvent,
        delayMinutes,
        sequenceOrder,
        isEnabled: true,
        ruleType: templateType,
      },
      create: {
        id: `${account.id}_${templateType}`,
        accountId: account.id,
        templateId: template.id,
        triggerEvent,
        delayMinutes,
        sequenceOrder,
        isEnabled: true,
        ruleType: templateType,
      },
    });
  }

  const lead = await prisma.lead.upsert({
    where: { id: "seed_lead_001" },
    update: {},
    create: {
      id: "seed_lead_001",
      accountId: account.id,
      firstName: "Maria",
      lastName: "Lopez",
      phone: "+14805550111",
      email: "maria@internal.invalid",
      serviceType: "water heater repair",
      source: "website",
      status: "new",
      smsConsentStatus: "granted",
      emailConsentStatus: "granted",
      consentSource: "seed_fixture",
    },
  });

  await prisma.leadTimelineEvent.create({
    data: {
      accountId: account.id,
      leadId: lead.id,
      eventType: "lead.created",
      eventLabel: "Lead created",
      eventPayloadJson: { source: "website" },
    },
  }).catch(() => {});
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
