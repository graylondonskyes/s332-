import { fixedWindowRateLimit } from "@/lib/rate-limit";
import { SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { setSession, hashPassword } from "@/lib/auth";
import { badRequest, created } from "@/lib/http";
import { signupSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "local";
  const limit = fixedWindowRateLimit(`signup:${ip}`, 20, 60 * 60 * 1000);
  if (!limit.allowed) return badRequest("Too many signup attempts. Try again later.");
  const body = await request.json();
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid signup payload", parsed.error.flatten());

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return badRequest("Email already in use.");

  const account = await prisma.account.create({
    data: {
      businessName: parsed.data.businessName,
      onboardingCompleted: false,
    },
  });

  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      fullName: parsed.data.fullName,
      passwordHash: await hashPassword(parsed.data.password),
      accountId: account.id,
    },
  });

  await prisma.subscription.create({
    data: {
      accountId: account.id,
      provider: "manual",
      planName: "starter",
      status: SubscriptionStatus.trial,
      includedSmsSegments: 500,
      smsOverageCents: 4,
      hardStopAtLimit: true,
      maxAutomatedSmsPerLead: 4,
      includedAiActions: 100,
    },
  });

  await prisma.settings.create({
    data: {
      accountId: account.id,
      defaultReplyEmail: parsed.data.email,
      notificationEmail: parsed.data.email,
      defaultFromName: parsed.data.businessName,
    },
  });

  await setSession(user.id);
  return created({ ok: true, userId: user.id, accountId: account.id });
}
