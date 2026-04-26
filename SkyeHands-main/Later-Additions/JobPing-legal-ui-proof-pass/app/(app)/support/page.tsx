import { AppShell } from "@/components/shared/app-shell";
import { Card } from "@/components/shared/card";
import { requireAccountUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSupportEmail } from "@/lib/support";
import { SupportTicketForm } from "@/components/operations/action-forms";

export default async function SupportPage() {
  const user = await requireAccountUser();
  const tickets = await prisma.supportTicket.findMany({ where: { accountId: user.accountId! }, orderBy: { createdAt: "desc" }, take: 20 });
  const supportEmail = getSupportEmail();
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.22em] text-indigo-600">Support</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight">Customer support command center</h1>
          <p className="mt-2 max-w-3xl text-slate-600">Create a support ticket, keep an audit trail, and route urgent operational issues to the configured support inbox.</p>
        </div>
        <Card>
          <SupportTicketForm />
          <p className="mt-4 text-sm text-slate-500">Direct support inbox: <a className="font-bold underline" href={`mailto:${supportEmail}`}>{supportEmail}</a></p>
        </Card>
        <Card>
          <h2 className="text-xl font-black">Recent tickets</h2>
          <div className="mt-4 space-y-3">
            {tickets.length === 0 ? <p className="text-sm text-slate-500">No support tickets yet.</p> : null}
            {tickets.map((ticket) => <div key={ticket.id} className="rounded-2xl border p-4"><div className="font-black">{ticket.subject}</div><div className="text-sm text-slate-500">{ticket.status} • {ticket.priority} • {ticket.createdAt.toLocaleString()}</div><p className="mt-2 text-sm text-slate-700">{ticket.body}</p></div>)}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
