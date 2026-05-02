import { prisma } from "@/lib/db";
import { requireAccountUser } from "@/lib/auth";
import { ok } from "@/lib/http";

export async function GET() {
  const user = await requireAccountUser();
  const rules = await prisma.automationRule.findMany({ where: { accountId: user.accountId! }, orderBy: { sequenceOrder: "asc" } });
  return ok(rules);
}
