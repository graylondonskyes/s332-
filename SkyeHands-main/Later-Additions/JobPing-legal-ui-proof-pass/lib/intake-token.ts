import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";

const TOKEN_PREFIX = "jpi_";

export function hashIntakeToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function generateIntakeToken() {
  return `${TOKEN_PREFIX}${randomBytes(24).toString("base64url")}`;
}

export function safeTokenCompare(rawToken: string, storedHash?: string | null) {
  if (!rawToken || !storedHash) return false;
  const candidate = Buffer.from(hashIntakeToken(rawToken));
  const expected = Buffer.from(storedHash);
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

export async function ensureAccountIntakeToken(accountId: string) {
  const account = await prisma.account.findUnique({ where: { id: accountId }, select: { publicIntakeTokenHash: true, publicIntakeTokenLast4: true } });
  if (!account) throw new Error("Account not found.");
  if (account.publicIntakeTokenHash) {
    return { token: null as string | null, last4: account.publicIntakeTokenLast4 || "set", newlyCreated: false };
  }
  const token = generateIntakeToken();
  await prisma.account.update({
    where: { id: accountId },
    data: { publicIntakeTokenHash: hashIntakeToken(token), publicIntakeTokenLast4: token.slice(-4) },
  });
  return { token, last4: token.slice(-4), newlyCreated: true };
}

export async function rotateAccountIntakeToken(accountId: string) {
  const token = generateIntakeToken();
  await prisma.account.update({
    where: { id: accountId },
    data: { publicIntakeTokenHash: hashIntakeToken(token), publicIntakeTokenLast4: token.slice(-4) },
  });
  return { token, last4: token.slice(-4) };
}

export async function resolveAccountByIntakeToken(rawToken: string) {
  const hash = hashIntakeToken(rawToken);
  return prisma.account.findFirst({ where: { publicIntakeTokenHash: hash }, include: { subscription: true } });
}
