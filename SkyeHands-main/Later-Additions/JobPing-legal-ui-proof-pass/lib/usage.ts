import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getPlan } from "@/lib/plans";

export function currentPeriodKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function estimateSmsSegments(body: string) {
  const length = body.length || 1;
  return Math.max(1, Math.ceil(length / 153));
}

const ACTIVE_USAGE_STATUSES = ["reserved", "posted"];

export async function getAccountUsage(accountId: string, periodKey = currentPeriodKey()) {
  const [subscription, rows] = await Promise.all([
    prisma.subscription.findUnique({ where: { accountId } }),
    prisma.usageLedger.groupBy({
      by: ["usageType", "status"],
      where: { accountId, periodKey },
      _sum: { quantity: true },
    }),
  ]);
  const plan = getPlan(subscription?.planName);
  const smsPosted = rows.find((r) => r.usageType === "sms_segment" && r.status === "posted")?._sum.quantity || 0;
  const smsReserved = rows.find((r) => r.usageType === "sms_segment" && r.status === "reserved")?._sum.quantity || 0;
  const aiPosted = rows.find((r) => r.usageType === "ai_action" && r.status === "posted")?._sum.quantity || 0;
  return {
    periodKey,
    subscription,
    smsUsed: smsPosted,
    smsReserved,
    smsCommitted: smsPosted + smsReserved,
    aiUsed: aiPosted,
    includedSmsSegments: subscription?.includedSmsSegments || plan.includedSmsSegments,
    includedAiActions: subscription?.includedAiActions || plan.includedAiActions,
    smsOverageEnabled: subscription?.smsOverageEnabled ?? false,
    hardStopAtLimit: subscription?.hardStopAtLimit ?? true,
    smsOverageCents: subscription?.smsOverageCents ?? plan.smsOverageCents,
  };
}

export async function assertSmsAllowance(input: { accountId: string; leadId?: string | null; messageEventId?: string | null; body: string; automated?: boolean; }) {
  const segments = estimateSmsSegments(input.body);
  const usage = await getAccountUsage(input.accountId);
  const projected = usage.smsCommitted + segments;
  if (input.automated && input.leadId) {
    const count = await prisma.messageEvent.count({
      where: { accountId: input.accountId, leadId: input.leadId, channel: "sms", direction: "outbound", status: { in: ["queued", "scheduled", "sent", "delivered"] } },
    });
    const max = usage.subscription?.maxAutomatedSmsPerLead ?? 4;
    if (count >= max) return { allowed: false, segments, reason: `Per-lead automated SMS cap reached (${max}).` };
  }
  if (projected > usage.includedSmsSegments && !usage.smsOverageEnabled) {
    return { allowed: false, segments, reason: `Monthly SMS fair-use limit reached: ${usage.smsCommitted}/${usage.includedSmsSegments}. Enable overages or upgrade.` };
  }
  if (projected > usage.includedSmsSegments && usage.hardStopAtLimit) {
    return { allowed: false, segments, reason: `Monthly SMS hard stop is enabled at ${usage.includedSmsSegments} segments.` };
  }
  return { allowed: true, segments, reason: null, billable: projected > usage.includedSmsSegments, unitCostCents: usage.smsOverageCents };
}

export async function reserveSmsAllowance(input: { accountId: string; leadId?: string | null; messageEventId: string; body: string; automated?: boolean; note?: string; }) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.usageLedger.findUnique({ where: { reservationKey: input.messageEventId } }).catch(() => null);
    if (existing) {
      if (existing.status === "reserved" || existing.status === "posted") return { allowed: true as const, segments: existing.quantity, reserved: existing.status === "reserved", reason: null as string | null };
      return { allowed: false as const, segments: existing.quantity, reserved: false, reason: `SMS reservation is ${existing.status}.` };
    }

    const segments = estimateSmsSegments(input.body);
    const subscription = await tx.subscription.findUnique({ where: { accountId: input.accountId } });
    const plan = getPlan(subscription?.planName);
    const rows = await tx.usageLedger.groupBy({
      by: ["usageType", "status"],
      where: { accountId: input.accountId, periodKey: currentPeriodKey(), usageType: "sms_segment", status: { in: ACTIVE_USAGE_STATUSES } },
      _sum: { quantity: true },
    });
    const committed = rows.reduce((sum, row) => sum + (row._sum.quantity || 0), 0);
    const included = subscription?.includedSmsSegments || plan.includedSmsSegments;
    const overageEnabled = subscription?.smsOverageEnabled ?? false;
    const hardStop = subscription?.hardStopAtLimit ?? true;
    const projected = committed + segments;

    if (input.automated && input.leadId) {
      const count = await tx.messageEvent.count({
        where: {
          accountId: input.accountId,
          leadId: input.leadId,
          channel: "sms",
          direction: "outbound",
          id: { not: input.messageEventId },
          status: { in: ["queued", "scheduled", "sent", "delivered"] },
        },
      });
      const max = subscription?.maxAutomatedSmsPerLead ?? 4;
      if (count + 1 > max) return { allowed: false as const, segments, reserved: false, reason: `Per-lead automated SMS cap reached (${max}).` };
    }

    if (projected > included && !overageEnabled) {
      return { allowed: false as const, segments, reserved: false, reason: `Monthly SMS fair-use limit reached: ${committed}/${included}. Enable overages or upgrade.` };
    }
    if (projected > included && hardStop) {
      return { allowed: false as const, segments, reserved: false, reason: `Monthly SMS hard stop is enabled at ${included} segments.` };
    }

    const overageCents = subscription?.smsOverageCents ?? plan.smsOverageCents;
    await tx.usageLedger.create({
      data: {
        accountId: input.accountId,
        leadId: input.leadId || null,
        messageEventId: input.messageEventId,
        usageType: "sms_segment",
        quantity: segments,
        billable: projected > included,
        unitCostCents: projected > included ? Math.round(overageCents) : null,
        periodKey: currentPeriodKey(),
        status: "reserved",
        reservationKey: input.messageEventId,
        note: input.note || "reserved_before_send",
      },
    });
    return { allowed: true as const, segments, reserved: true, reason: null as string | null };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function postReservedSmsUsage(messageEventId: string) {
  const existing = await prisma.usageLedger.findUnique({ where: { reservationKey: messageEventId } }).catch(() => null);
  if (!existing) return null;
  if (existing.status === "posted") return existing;
  return prisma.usageLedger.update({ where: { id: existing.id }, data: { status: "posted", postedAt: new Date(), note: "sent_sms" } });
}

export async function releaseReservedSmsUsage(messageEventId: string, reason: string) {
  const existing = await prisma.usageLedger.findUnique({ where: { reservationKey: messageEventId } }).catch(() => null);
  if (!existing || existing.status !== "reserved") return existing;
  return prisma.usageLedger.update({ where: { id: existing.id }, data: { status: "released", releasedAt: new Date(), note: reason } });
}

export async function releaseReservedSmsUsageForLead(input: { accountId: string; leadId: string; reason: string }) {
  return prisma.usageLedger.updateMany({
    where: { accountId: input.accountId, leadId: input.leadId, usageType: "sms_segment", status: "reserved" },
    data: { status: "released", releasedAt: new Date(), note: input.reason },
  });
}

export async function recordUsage(input: { accountId: string; leadId?: string | null; messageEventId?: string | null; usageType: string; quantity: number; billable?: boolean; unitCostCents?: number | null; note?: string; }) {
  return prisma.usageLedger.create({
    data: {
      accountId: input.accountId,
      leadId: input.leadId || null,
      messageEventId: input.messageEventId || null,
      usageType: input.usageType,
      quantity: input.quantity,
      billable: Boolean(input.billable),
      unitCostCents: input.unitCostCents == null ? null : Math.round(input.unitCostCents),
      periodKey: currentPeriodKey(),
      status: "posted",
      postedAt: new Date(),
      note: input.note,
    },
  });
}
