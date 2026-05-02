import { prisma } from "@/lib/db";
import { currentPeriodKey } from "@/lib/usage";

export async function getValueReport(accountId: string) {
  const periodKey = currentPeriodKey();
  const [leads, messages, usage, account] = await Promise.all([
    prisma.lead.groupBy({ by: ["status"], where: { accountId }, _count: true }),
    prisma.messageEvent.groupBy({ by: ["status"], where: { accountId }, _count: true }),
    prisma.usageLedger.groupBy({ by: ["usageType", "billable"], where: { accountId, periodKey }, _sum: { quantity: true, unitCostCents: true } }),
    prisma.account.findUnique({ where: { id: accountId }, include: { subscription: true } }),
  ]);
  const leadCounts = Object.fromEntries(leads.map((row) => [row.status, row._count]));
  const messageCounts = Object.fromEntries(messages.map((row) => [row.status, row._count]));
  const completed = leadCounts.completed || 0;
  const booked = leadCounts.booked || 0;
  const assumedRecoveredJobs = Math.max(0, Math.floor((messageCounts.sent || 0) / 12));
  const conservativeJobValue = 250;
  const estimatedRecoveredRevenue = assumedRecoveredJobs * conservativeJobValue;
  const smsSegments = usage.find((row) => row.usageType === "sms_segment")?._sum.quantity || 0;
  const aiActions = usage.find((row) => row.usageType === "ai_action")?._sum.quantity || 0;
  const planPrice = account?.subscription?.planName === "pro" ? 299 : account?.subscription?.planName === "growth" ? 179 : 99;
  const estimatedRoi = estimatedRecoveredRevenue > 0 ? Math.round((estimatedRecoveredRevenue / planPrice) * 10) / 10 : 0;
  return { periodKey, account, leadCounts, messageCounts, completed, booked, smsSegments, aiActions, assumedRecoveredJobs, conservativeJobValue, estimatedRecoveredRevenue, planPrice, estimatedRoi };
}
