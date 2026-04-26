import { prisma } from "@/lib/db";
import { requireAccountUser } from "@/lib/auth";
import { badRequest, ok } from "@/lib/http";
import { getTemplatePack } from "@/lib/template-packs";

export async function POST(request: Request) {
  const user = await requireAccountUser();
  const body = await request.json().catch(() => ({}));
  const packId = typeof body.packId === "string" ? body.packId : undefined;
  const pack = getTemplatePack(packId);

  for (const [templateType, templateBody] of Object.entries(pack.templates)) {
    await prisma.messageTemplate.upsert({
      where: { accountId_templateType: { accountId: user.accountId!, templateType: templateType as any } },
      update: { body: templateBody, name: `${pack.name} ${templateType.replaceAll("_", " ")}`, isEnabled: true, channel: "sms" },
      create: { accountId: user.accountId!, templateType: templateType as any, name: `${pack.name} ${templateType.replaceAll("_", " ")}`, body: templateBody, isEnabled: true, channel: "sms" },
    });
  }

  await prisma.account.update({ where: { id: user.accountId! }, data: { niche: pack.id } }).catch(() => null);
  return ok({ ok: true, packId: pack.id });
}
