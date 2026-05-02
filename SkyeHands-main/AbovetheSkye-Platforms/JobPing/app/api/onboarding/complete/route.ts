import { prisma } from "@/lib/db";
import { requireAccountUser } from "@/lib/auth";
import { badRequest, ok } from "@/lib/http";
import { onboardingSchema } from "@/lib/validators";
import { getTemplatePack } from "@/lib/template-packs";

export async function POST(request: Request) {
  const user = await requireAccountUser();
  const body = await request.json();
  const parsed = onboardingSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid onboarding payload", parsed.error.flatten());

  const { templatePackId, ...accountData } = parsed.data;
  const pack = getTemplatePack(templatePackId || parsed.data.niche);

  await prisma.account.update({
    where: { id: user.accountId! },
    data: { ...accountData, niche: pack.id, onboardingCompleted: true },
  });

  await prisma.settings.update({
    where: { accountId: user.accountId! },
    data: {
      defaultFromName: parsed.data.businessName,
      defaultReplyEmail: parsed.data.replyEmail,
      notificationEmail: parsed.data.replyEmail,
    },
  }).catch(async () => {
    await prisma.settings.create({
      data: {
        accountId: user.accountId!,
        defaultFromName: parsed.data.businessName,
        defaultReplyEmail: parsed.data.replyEmail,
        notificationEmail: parsed.data.replyEmail,
      },
    });
  });

  for (const [templateType, templateBody] of Object.entries(pack.templates)) {
    const template = await prisma.messageTemplate.upsert({
      where: { accountId_templateType: { accountId: user.accountId!, templateType: templateType as any } },
      update: { body: templateBody, name: `${pack.name} ${templateType.replaceAll("_", " ")}`, isEnabled: true, channel: "sms" },
      create: { accountId: user.accountId!, templateType: templateType as any, name: `${pack.name} ${templateType.replaceAll("_", " ")}`, body: templateBody, isEnabled: true, channel: "sms" },
    });
    const triggerEvent = templateType === "review_request" ? "lead.completed" : "lead.created";
    const delayMinutes = templateType === "followup_1" ? 1440 : templateType === "followup_2" ? 2880 : 0;
    const sequenceOrder = templateType === "welcome_reply" ? 0 : templateType === "followup_1" ? 1 : templateType === "followup_2" ? 2 : 0;
    await prisma.automationRule.upsert({
      where: { id: `${user.accountId}_${templateType}` },
      update: { templateId: template.id, triggerEvent, delayMinutes, sequenceOrder, isEnabled: true, ruleType: templateType },
      create: { id: `${user.accountId}_${templateType}`, accountId: user.accountId!, templateId: template.id, triggerEvent, delayMinutes, sequenceOrder, isEnabled: true, ruleType: templateType },
    });
  }

  return ok({ ok: true, appliedPack: pack.id });
}
