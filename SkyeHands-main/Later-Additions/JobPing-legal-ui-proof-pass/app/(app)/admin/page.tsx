import Link from "next/link";
import { SubscriptionStatus } from "@prisma/client";
import { AppShell } from "@/components/shared/app-shell";
import { Card } from "@/components/shared/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { requireAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { cancelFailedFutureSends, updateSubscriptionStatus } from "./actions";

export default async function AdminConsolePage() {
  await requireAdminUser();

  const [accounts, failedMessages, recentIngest, billingEvents] = await Promise.all([
    prisma.account.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        subscription: true,
        _count: { select: { leads: true, messageEvents: true, consentRecords: true } },
      },
      take: 50,
    }),
    prisma.messageEvent.findMany({
      where: { status: { in: ["failed", "skipped"] } },
      include: { lead: true, account: true },
      orderBy: { updatedAt: "desc" },
      take: 25,
    }),
    prisma.ingestEvent.findMany({ orderBy: { createdAt: "desc" }, take: 12, include: { account: true } }),
    prisma.billingEvent.findMany({ orderBy: { createdAt: "desc" }, take: 12, include: { account: true } }),
  ]);

  const activeCount = accounts.filter((account) => ["trial", "active"].includes(account.subscription?.status || "")).length;
  const blockedCount = accounts.filter((account) => ["past_due", "canceled"].includes(account.subscription?.status || "")).length;

  return (
    <AppShell>
      <div className="space-y-7">
        <section className="rounded-[2rem] bg-slate-950 p-7 text-white shadow-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-indigo-200">Operator surface</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-4xl font-black tracking-tight">Support Console</h1>
              <p className="mt-2 max-w-3xl text-slate-300">Monitor customer accounts, billing access, failed sends, inbound provider events, and support-safe account actions from one internal screen.</p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl bg-white/10 p-4"><div className="text-2xl font-black">{accounts.length}</div><div className="text-xs text-slate-300">Accounts</div></div>
              <div className="rounded-2xl bg-white/10 p-4"><div className="text-2xl font-black">{activeCount}</div><div className="text-xs text-slate-300">Allowed</div></div>
              <div className="rounded-2xl bg-white/10 p-4"><div className="text-2xl font-black">{blockedCount}</div><div className="text-xs text-slate-300">Blocked</div></div>
            </div>
          </div>
        </section>

        <Card>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black">Customer accounts</h2>
              <p className="mt-1 text-sm text-slate-500">Manual status control is included for launch support and billing recovery.</p>
            </div>
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="py-3">Business</th><th>Status</th><th>Leads</th><th>Messages</th><th>Consent</th><th>Billing override</th><th>Safety</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {accounts.map((account) => (
                  <tr key={account.id} className="align-top">
                    <td className="py-4">
                      <div className="font-bold">{account.businessName}</div>
                      <div className="text-xs text-slate-500">{account.niche || "No niche"} • {account.replyEmail || "No reply email"}</div>
                    </td>
                    <td className="py-4"><StatusBadge label={account.subscription?.status || "missing"} /></td>
                    <td className="py-4">{account._count.leads}</td>
                    <td className="py-4">{account._count.messageEvents}</td>
                    <td className="py-4">{account._count.consentRecords}</td>
                    <td className="py-4">
                      <form action={updateSubscriptionStatus} className="flex gap-2">
                        <input type="hidden" name="accountId" value={account.id} />
                        <select name="status" defaultValue={account.subscription?.status || "trial"} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                          {Object.values(SubscriptionStatus).map((status) => <option key={status} value={status}>{status}</option>)}
                        </select>
                        <button className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white">Save</button>
                      </form>
                    </td>
                    <td className="py-4">
                      <form action={cancelFailedFutureSends}>
                        <input type="hidden" name="accountId" value={account.id} />
                        <button className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700">Cancel queued</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <h2 className="text-2xl font-black">Failed or skipped sends</h2>
            <div className="mt-4 space-y-3">
              {failedMessages.length === 0 ? <p className="text-sm text-slate-500">No failed or skipped sends.</p> : null}
              {failedMessages.map((event) => (
                <div key={event.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3"><div className="font-bold">{event.account.businessName}</div><StatusBadge label={event.status} /></div>
                  <div className="mt-1 text-sm text-slate-500">{event.lead.firstName || "Lead"} • {event.channel} • {event.updatedAt.toLocaleString()}</div>
                  <p className="mt-2 text-sm text-rose-700">{event.failureReason || "No failure reason stored."}</p>
                  <Link className="mt-3 inline-block text-sm font-bold text-indigo-700" href={`/leads/${event.leadId}`}>Open lead</Link>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-2xl font-black">Provider and billing events</h2>
            <div className="mt-4 space-y-3">
              {[...recentIngest.map((event) => ({ id: event.id, label: event.rawType, account: event.account?.businessName || "Unmatched", date: event.createdAt, kind: "ingest" })), ...billingEvents.map((event) => ({ id: event.id, label: event.eventType, account: event.account.businessName, date: event.createdAt, kind: "billing" }))]
                .sort((a, b) => b.date.getTime() - a.date.getTime())
                .slice(0, 16)
                .map((event) => (
                <div key={`${event.kind}-${event.id}`} className="rounded-2xl border border-slate-200 p-4">
                  <div className="font-bold">{event.label}</div>
                  <div className="text-sm text-slate-500">{event.account} • {event.kind} • {event.date.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
