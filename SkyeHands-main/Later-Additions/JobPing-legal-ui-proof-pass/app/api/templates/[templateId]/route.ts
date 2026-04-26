import { prisma } from "@/lib/db";
import { requireAccountUser } from "@/lib/auth";
import { badRequest, ok } from "@/lib/http";
import { templateUpdateSchema } from "@/lib/validators";
import { assertAccountMatch } from "@/lib/permissions";

export async function PATCH(request: Request, { params }: { params: Promise<{ templateId: string }> }) {
  const user = await requireAccountUser();
  const { templateId } = await params;
  const template = await prisma.messageTemplate.findUnique({ where: { id: templateId } });
  if (!template) return badRequest("Template not found.");
  assertAccountMatch(user.accountId, template.accountId);

  const body = await request.json();
  const parsed = templateUpdateSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid template payload", parsed.error.flatten());

  const updated = await prisma.messageTemplate.update({
    where: { id: templateId },
    data: parsed.data,
  });

  return ok(updated);
}
