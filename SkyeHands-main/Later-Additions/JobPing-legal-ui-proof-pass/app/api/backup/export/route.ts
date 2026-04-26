import { requireAccountUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { created, ok } from "@/lib/http";

export async function GET() {
  const user = await requireAccountUser();
  const exports = await prisma.backupExport.findMany({ where: { accountId: user.accountId! }, orderBy: { createdAt: "desc" }, take: 20 });
  return ok(exports);
}

export async function POST() {
  const user = await requireAccountUser();
  const [account, leads, templates, rules, settings, usage] = await Promise.all([
    prisma.account.findUnique({ where: { id: user.accountId! }, include: { subscription: true } }),
    prisma.lead.findMany({ where: { accountId: user.accountId! }, include: { leadNotes: true, messageEvents: true, timelineEvents: true } }),
    prisma.messageTemplate.findMany({ where: { accountId: user.accountId! } }),
    prisma.automationRule.findMany({ where: { accountId: user.accountId! } }),
    prisma.settings.findUnique({ where: { accountId: user.accountId! } }),
    prisma.usageLedger.findMany({ where: { accountId: user.accountId! }, orderBy: { createdAt: "desc" }, take: 500 }),
  ]);
  const payload = { exportedAt: new Date().toISOString(), account, settings, templates, rules, leads, usage };
  const recordCount = leads.length + templates.length + rules.length + usage.length;
  const exportRecord = await prisma.backupExport.create({ data: { accountId: user.accountId!, exportType: "account_portable_json", recordCount, payloadJson: payload, expiresAt: new Date(Date.now() + 7 * 86400000) } });
  return created(exportRecord);
}
