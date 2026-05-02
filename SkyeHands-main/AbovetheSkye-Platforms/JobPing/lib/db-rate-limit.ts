import { prisma } from "@/lib/db";

export async function persistentFixedWindowRateLimit(input: { bucketKey: string; max: number; windowMs: number }) {
  const now = new Date();
  const resetAt = new Date(now.getTime() + input.windowMs);
  const current = await prisma.rateLimitBucket.findUnique({ where: { bucketKey: input.bucketKey } });
  if (!current || current.resetAt <= now) {
    await prisma.rateLimitBucket.upsert({
      where: { bucketKey: input.bucketKey },
      create: { bucketKey: input.bucketKey, count: 1, resetAt },
      update: { count: 1, resetAt },
    });
    return { allowed: true, remaining: input.max - 1, resetAt };
  }
  if (current.count >= input.max) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt };
  }
  const updated = await prisma.rateLimitBucket.update({ where: { bucketKey: input.bucketKey }, data: { count: { increment: 1 } } });
  return { allowed: true, remaining: Math.max(0, input.max - updated.count), resetAt: updated.resetAt };
}
