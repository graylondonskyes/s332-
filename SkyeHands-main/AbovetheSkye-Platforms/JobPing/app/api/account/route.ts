import { prisma } from "@/lib/db";
import { requireAccountUser } from "@/lib/auth";
import { ok } from "@/lib/http";

async function readBody(request: Request) {
  const type = request.headers.get("content-type") || "";
  if (type.includes("application/json")) return request.json();
  const form = await request.formData();
  const raw = Object.fromEntries(form.entries());
  return { ...raw, dailyDigestEnabled: raw.dailyDigestEnabled === "on", failedSendAlertsEnabled: raw.failedSendAlertsEnabled === "on", weeklyReportEnabled: raw.weeklyReportEnabled === "on", autoPauseFailedSends: raw.autoPauseFailedSends === "on", dailyAutomatedSmsLimit: Number(raw.dailyAutomatedSmsLimit || 75), leadCooldownHours: Number(raw.leadCooldownHours || 18) };
}

export async function GET() {
  const user = await requireAccountUser();
  const account = await prisma.account.findUnique({ where: { id: user.accountId! }, include: { settings: true, subscription: true } });
  return ok(account);
}

async function updateAccount(request: Request) {
  const user = await requireAccountUser();
  const body = await readBody(request);
  const account = await prisma.account.update({
    where: { id: user.accountId! },
    data: {
      businessName: body.businessName || undefined,
      niche: body.niche || undefined,
      businessPhone: body.businessPhone || undefined,
      replyEmail: body.replyEmail || undefined,
      reviewUrl: body.reviewUrl || undefined,
      serviceArea: body.serviceArea || undefined,
      timezone: body.timezone || undefined,
      settings: { upsert: { create: { notificationEmail: body.notificationEmail || body.replyEmail, ownerAlertEmail: body.ownerAlertEmail || body.notificationEmail || body.replyEmail, dailyDigestEnabled: Boolean(body.dailyDigestEnabled), failedSendAlertsEnabled: Boolean(body.failedSendAlertsEnabled), weeklyReportEnabled: Boolean(body.weeklyReportEnabled), quietHoursStart: body.quietHoursStart || "20:00", quietHoursEnd: body.quietHoursEnd || "08:00", dailyAutomatedSmsLimit: body.dailyAutomatedSmsLimit || 75, leadCooldownHours: body.leadCooldownHours || 18, autoPauseFailedSends: Boolean(body.autoPauseFailedSends) }, update: { notificationEmail: body.notificationEmail || undefined, ownerAlertEmail: body.ownerAlertEmail || undefined, dailyDigestEnabled: Boolean(body.dailyDigestEnabled), failedSendAlertsEnabled: Boolean(body.failedSendAlertsEnabled), weeklyReportEnabled: body.weeklyReportEnabled === undefined ? undefined : Boolean(body.weeklyReportEnabled), quietHoursStart: body.quietHoursStart || undefined, quietHoursEnd: body.quietHoursEnd || undefined, dailyAutomatedSmsLimit: body.dailyAutomatedSmsLimit || undefined, leadCooldownHours: body.leadCooldownHours || undefined, autoPauseFailedSends: body.autoPauseFailedSends === undefined ? undefined : Boolean(body.autoPauseFailedSends) } } },
    },
    include: { settings: true, subscription: true },
  });
  return ok(account);
}

export async function PATCH(request: Request) { return updateAccount(request); }
export async function POST(request: Request) { return updateAccount(request); }
