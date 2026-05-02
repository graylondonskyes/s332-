import Link from "next/link";
import { AppShell } from "@/components/shared/app-shell";
import { Card } from "@/components/shared/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { requireAccountUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CreateLeadForm } from "@/components/leads/create-lead-form";

export default async function LeadsPage() {
  const user = await requireAccountUser();
  const leads = await prisma.lead.findMany({
    where: { accountId: user.accountId! },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Leads</h1>
          <p className="mt-1 text-zinc-600">Create and manage lead records.</p>
        </div>
        <CreateLeadForm />
        <Card>
          <div className="space-y-3">
            {leads.length === 0 ? <p className="text-sm text-zinc-500">No leads yet.</p> : null}
            {leads.map((lead) => (
              <Link key={lead.id} href={`/leads/${lead.id}`} className="block rounded-lg border border-zinc-200 p-4 hover:bg-zinc-50">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-medium">{[lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Unnamed lead"}</div>
                    <div className="text-sm text-zinc-500">{lead.serviceType || "No service type"} • {lead.phone || lead.email || "No contact"}</div>
                  </div>
                  <StatusBadge label={lead.status} />
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
