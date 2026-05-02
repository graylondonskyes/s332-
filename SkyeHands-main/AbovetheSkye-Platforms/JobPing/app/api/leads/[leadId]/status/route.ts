import { prisma } from "@/lib/db";
import { requireAccountUser } from "@/lib/auth";
import { badRequest, ok } from "@/lib/http";
import { leadStatusSchema } from "@/lib/validators";
import { assertAccountMatch } from "@/lib/permissions";
import { appendTimelineEvent } from "@/lib/timeline";
import { dispatchAutomationForLead } from "@/lib/automation";

export async function POST(request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const user = await requireAccountUser();
  const { leadId } = await params;
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return badRequest("Lead not found.");
  assertAccountMatch(user.accountId, lead.accountId);

  const body = await request.json();
  const parsed = leadStatusSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid status payload", parsed.error.flatten());

  const updated = await prisma.lead.update({
    where: { id: leadId },
    data: {
      status: parsed.data.status,
      completedAt: parsed.data.status === "completed" ? new Date() : null,
      lostAt: parsed.data.status === "lost" ? new Date() : null,
    },
  });

  await appendTimelineEvent({
    accountId: user.accountId!,
    leadId,
    eventType: "lead.status_changed",
    eventLabel: `Lead moved to ${parsed.data.status}`,
    createdByUserId: user.id,
    eventPayloadJson: { status: parsed.data.status },
  });

  if (["completed", "lost"].includes(parsed.data.status)) {
    await prisma.messageEvent.updateMany({
      where: { accountId: user.accountId!, leadId, status: { in: ["queued", "scheduled", "retrying"] } },
      data: { status: "canceled", failureReason: `Canceled because lead moved to ${parsed.data.status}.` },
    });
  }

  if (parsed.data.status === "completed") {
    await dispatchAutomationForLead({ accountId: user.accountId!, leadId, triggerEvent: "lead.completed" });
  }

  return ok(updated);
}
