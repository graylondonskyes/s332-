import { fixedWindowRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/db";
import { setSession, verifyPassword } from "@/lib/auth";
import { badRequest, ok, unauthorized } from "@/lib/http";
import { loginSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "local";
  const limit = fixedWindowRateLimit(`login:${ip}`, 10, 15 * 60 * 1000);
  if (!limit.allowed) return unauthorized("Too many login attempts. Try again later.");
  const body = await request.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid login payload", parsed.error.flatten());

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user?.passwordHash) return unauthorized("Invalid credentials");

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) return unauthorized("Invalid credentials");

  await setSession(user.id);
  return ok({ ok: true });
}
