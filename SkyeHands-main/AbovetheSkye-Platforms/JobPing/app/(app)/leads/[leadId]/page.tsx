import { notFound } from "next/navigation";
import { AppShell } from "@/components/shared/app-shell";
import { Card } from "@/components/shared/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { requireAccountUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LeadStatusForm } from "@/components/leads/lead-status-form";
import { AddNoteForm } from "@/components/leads/add-note-form";
import { RetryMessageForm } from "@/components/leads/retry-message-form";

export default async function LeadDetailPage({ params }: { params: Promise<{ leadId: string }> }) {
  const user = await requireAccountUser();
  const { leadId } = await params;
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, accountId: user.accountId! },
    include: {
      leadNotes: { orderBy: { createdAt: "desc" }, include: { author: true } },
      messageEvents: { orderBy: { createdAt: "desc" } },
      timelineEvents: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!lead) notFound();

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{[lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Unnamed lead"}</h1>
            <p className="mt-1 text-zinc-600">{lead.phone || lead.email || "No contact info"}</p>
          </div>
          <StatusBadge label={lead.status} />
        </div>

        <Card>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm text-zinc-500">Update lead status</div>
              <div className="font-medium">Move this lead through the pipeline.</div>
            </div>
            <LeadStatusForm leadId={lead.id} currentStatus={lead.status} />
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="text-xl font-semibold">Notes</h2>
            <div className="mt-4 space-y-3">
              <AddNoteForm leadId={lead.id} />
              {lead.leadNotes.map((note) => (
                <div key={note.id} className="rounded-lg border border-zinc-200 p-3">
                  <div className="text-sm font-medium">{note.author.fullName ?? note.author.email}</div>
                  <div className="mt-1 text-sm text-zinc-700">{note.body}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-xl font-semibold">Message history</h2>
            <div className="mt-4 space-y-3">
              {lead.messageEvents.map((event) => (
                <div key={event.id} className="rounded-lg border border-zinc-200 p-3">
                  <div className="font-medium">{event.status}</div>
                  <div className="text-sm text-zinc-500">{event.channel} • {event.createdAt.toLocaleString()}</div>
                  <div className="mt-2 text-sm text-zinc-700">{event.bodySnapshot}</div>
                  {event.failureReason ? <div className="mt-2 text-sm text-red-600">{event.failureReason}</div> : null}
                  {["failed", "skipped"].includes(event.status) ? <div className="mt-3"><RetryMessageForm eventId={event.id} /></div> : null}
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card>
          <h2 className="text-xl font-semibold">Timeline</h2>
          <div className="mt-4 space-y-3">
            {lead.timelineEvents.map((event) => (
              <div key={event.id} className="rounded-lg border border-zinc-200 p-3">
                <div className="font-medium">{event.eventLabel}</div>
                <div className="text-sm text-zinc-500">{event.eventType} • {event.createdAt.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
