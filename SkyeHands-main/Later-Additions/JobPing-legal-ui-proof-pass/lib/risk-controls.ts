import { MessageStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { releaseReservedSmsUsageForLead } from "@/lib/usage";

function parseHourMinute(value?: string | null) {
  const raw = value || "";
  const [h, m] = raw.split(":").map((x) => Number(x));
  if (!Number.isFinite(h) || h < 0 || h > 23) return null;
  if (!Number.isFinite(m) || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function minutesNow(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes();
}

function isInsideQuietHours(start?: string | null, end?: string | null, now = new Date()) {
  const s = parseHourMinute(start);
  const e = parseHourMinute(end);
  if (s == null || e == null || s === e) return false;
  const n = minutesNow(now);
  return s < e ? n >= s && n < e : n >= s || n < e;
}

export async function assertAutomationRiskControls(input: { accountId: string; leadId: string; channel: string; automated?: boolean }) {
  if (!input.automated || input.channel !== "sms") return { allowed: true as const, reason: null as string | null };

  const settings = await prisma.settings.findUnique({ where: { accountId: input.accountId } });
  if (!settings) return { allowed: true as const, reason: null };

  if (isInsideQuietHours(settings.quietHoursStart, settings.quietHoursEnd)) {
    return { allowed: false as const, reason: `Quiet hours are active (${settings.quietHoursStart || "20:00"}-${settings.quietHoursEnd || "08:00"}).` };
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const dailyLimit = settings.dailyAutomatedSmsLimit ?? 75;
  const sentToday = await prisma.messageEvent.count({
    where: {
      accountId: input.accountId,
      channel: "sms",
      direction: "outbound",
      status: { in: [MessageStatus.queued, MessageStatus.scheduled, MessageStatus.sent, MessageStatus.delivered] },
      createdAt: { gte: startOfDay },
    },
  });
  if (sentToday >= dailyLimit) {
    return { allowed: false as const, reason: `Daily automated SMS safety limit reached (${dailyLimit}).` };
  }

  const cooldownHours = settings.leadCooldownHours ?? 18;
  if (cooldownHours > 0) {
    const since = new Date(Date.now() - cooldownHours * 60 * 60 * 1000);
    const recent = await prisma.messageEvent.findFirst({
      where: {
        accountId: input.accountId,
        leadId: input.leadId,
        channel: "sms",
        direction: "outbound",
        status: { in: [MessageStatus.queued, MessageStatus.scheduled, MessageStatus.sent, MessageStatus.delivered] },
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
    });
    if (recent) {
      return { allowed: false as const, reason: `Lead cooldown is active (${cooldownHours}h).` };
    }
  }

  return { allowed: true as const, reason: null };
}

export async function cancelQueuedAutomationsForLead(input: { accountId: string; leadId: string; reason: string }) {
  const updated = await prisma.messageEvent.updateMany({
    where: {
      accountId: input.accountId,
      leadId: input.leadId,
      status: { in: [MessageStatus.queued, MessageStatus.scheduled, MessageStatus.retrying] },
    },
    data: { status: MessageStatus.canceled, failureReason: input.reason, updatedAt: new Date() },
  });
  await releaseReservedSmsUsageForLead({ accountId: input.accountId, leadId: input.leadId, reason: input.reason });
  return updated;
}
