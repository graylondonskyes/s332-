import { prisma } from "@/lib/db";
import { requireAccountUser } from "@/lib/auth";
import { badRequest, ok } from "@/lib/http";
import { assertAccountMatch } from "@/lib/permissions";

export async function GET(_: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const user = await requireAccountUser();
  const { leadId } = await params;
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return badRequest("Lead not found.");
  assertAccountMatch(user.accountId, lead.accountId);
  return ok(lead);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const user = await requireAccountUser();
  const { leadId } = await params;
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return badRequest("Lead not found.");
  assertAccountMatch(user.accountId, lead.accountId);

  const body = await request.json();
  const updated = await prisma.lead.update({
    where: { id: leadId },
    data: {
      firstName: body.firstName,
      lastName: body.lastName,
      phone: body.phone,
      email: body.email,
      serviceType: body.serviceType,
      source: body.source,
      notes: body.notes,
    },
  });

  return ok(updated);
}
