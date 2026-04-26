import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { createHash, timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";

const cookieName = () => getEnv("SESSION_COOKIE_NAME");
const sessionSecret = () => getEnv("SESSION_SECRET");

function sign(value: string) {
  return createHash("sha256").update(`${value}:${sessionSecret()}`).digest("hex");
}

function buildSessionValue(userId: string) {
  const signature = sign(userId);
  return `${userId}.${signature}`;
}

function parseSessionValue(value: string | undefined) {
  if (!value) return null;
  const [userId, signature] = value.split(".");
  if (!userId || !signature) return null;
  const expected = sign(userId);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) return null;
  return userId;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function setSession(userId: string) {
  const cookieStore = await cookies();
  cookieStore.set(cookieName(), buildSessionValue(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(cookieName());
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(cookieName())?.value;
  const userId = parseSessionValue(raw);
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      account: {
        include: {
          subscription: true,
          settings: true,
        },
      },
    },
  });

  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAccountUser() {
  const user = await requireUser();
  if (!user.accountId) redirect("/onboarding");
  return user;
}
