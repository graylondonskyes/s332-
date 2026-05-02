import { requireAccountUser } from "@/lib/auth";
import { badRequest, ok } from "@/lib/http";
import { prisma } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  smsOverageEnabled: z.boolean().optional(),
  hardStopAtLimit: z.boolean().optional(),
  maxAutomatedSmsPerLead: z.number().int().min(1).max(12).optional(),
});

export async function PATCH(request: Request) {
  const user = await requireAccountUser();
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid usage-limit payload", parsed.error.flatten());
  const updated = await prisma.subscription.update({ where: { accountId: user.accountId! }, data: parsed.data });
  return ok(updated);
}
