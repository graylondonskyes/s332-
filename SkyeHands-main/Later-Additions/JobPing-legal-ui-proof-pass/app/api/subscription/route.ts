import { prisma } from "@/lib/db";
import { requireAccountUser } from "@/lib/auth";
import { ok } from "@/lib/http";

export async function GET() {
  const user = await requireAccountUser();
  const subscription = await prisma.subscription.findUnique({ where: { accountId: user.accountId! } });
  return ok(subscription);
}
