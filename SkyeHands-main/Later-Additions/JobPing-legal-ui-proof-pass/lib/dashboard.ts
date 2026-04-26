import { prisma } from "@/lib/db";

export async function getDashboardSummary(accountId: string) {
  const [leadCounts, recentActivity, messageStats] = await Promise.all([
    prisma.lead.groupBy({
      by: ["status"],
      where: { accountId },
      _count: true,
    }),
    prisma.leadTimelineEvent.findMany({
      where: { accountId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.messageEvent.groupBy({
      by: ["status"],
      where: { accountId },
      _count: true,
    }),
  ]);

  return { leadCounts, recentActivity, messageStats };
}
