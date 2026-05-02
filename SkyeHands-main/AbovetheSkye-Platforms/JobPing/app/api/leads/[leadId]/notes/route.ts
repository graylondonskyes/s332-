import { prisma } from "@/lib/db";
import { requireAccountUser } from "@/lib/auth";
import { badRequest, created } from "@/lib/http";
import { noteSchema } from "@/lib/validators";
import { assertAccountMatch } from "@/lib/permissions";
import { appendTimelineEvent } from "@/lib/timeline";

export async function POST(request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const user = await requireAccountUser();
  const { leadId } = await params;
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return badRequest("Lead not found.");
  assertAccountMatch(user.accountId, lead.accountId);

  const body = await request.json();
  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid note payload", parsed.error.flatten());

  const note = await prisma.leadNote.create({
    data: {
      leadId,
      accountId: user.accountId!,
      authorUserId: user.id,
      body: parsed.data.body,
    },
  });

  await appendTimelineEvent({
    accountId: user.accountId!,
    leadId,
    eventType: "note.added",
    eventLabel: "Note added",
    createdByUserId: user.id,
  });

  return created(note);
}
