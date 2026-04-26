import { prisma } from "@/lib/db";
import { requireAccountUser } from "@/lib/auth";
import { badRequest, ok } from "@/lib/http";
import { automationUpdateSchema } from "@/lib/validators";
import { assertAccountMatch } from "@/lib/permissions";

export async function PATCH(request: Request, { params }: { params: Promise<{ ruleId: string }> }) {
  const user = await requireAccountUser();
  const { ruleId } = await params;
  const rule = await prisma.automationRule.findUnique({ where: { id: ruleId } });
  if (!rule) return badRequest("Rule not found.");
  assertAccountMatch(user.accountId, rule.accountId);

  const body = await request.json();
  const parsed = automationUpdateSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid rule payload", parsed.error.flatten());

  const updated = await prisma.automationRule.update({ where: { id: ruleId }, data: parsed.data });
  return ok(updated);
}
