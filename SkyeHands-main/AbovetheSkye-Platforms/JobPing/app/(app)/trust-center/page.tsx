import { AppShell } from "@/components/shared/app-shell";
import { Card } from "@/components/shared/card";
import { requireAccountUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getReadinessChecklist } from "@/lib/readiness";

export default async function TrustCenterPage() {
  const user = await requireAccountUser();
  const [failed, optouts, exports, notifications] = await Promise.all([
    prisma.messageEvent.count({ where: { accountId: user.accountId!, status: { in: ["failed", "skipped"] } } }),
    prisma.consentRecord.count({ where: { accountId: user.accountId!, status: { in: ["denied", "revoked"] } } }),
    prisma.backupExport.count({ where: { accountId: user.accountId! } }),
    prisma.notificationEvent.count({ where: { accountId: user.accountId! } }),
  ]);
  const checks = getReadinessChecklist(user.account);
  return (
    <AppShell>
      <div className="space-y-6">
        <div><p className="text-sm font-black uppercase tracking-[0.22em] text-indigo-600">Trust center</p><h1 className="mt-2 text-4xl font-black tracking-tight">Operational safety and transparency</h1><p className="mt-2 max-w-3xl text-slate-600">A customer-facing proof surface for consent, usage, exports, failed sends, and launch readiness.</p></div>
        <div className="grid gap-4 md:grid-cols-4"><Card><div className="text-3xl font-black">{failed}</div><p className="text-sm text-slate-500">Failed/skipped sends</p></Card><Card><div className="text-3xl font-black">{optouts}</div><p className="text-sm text-slate-500">Opt-out records</p></Card><Card><div className="text-3xl font-black">{exports}</div><p className="text-sm text-slate-500">Exports generated</p></Card><Card><div className="text-3xl font-black">{notifications}</div><p className="text-sm text-slate-500">Alert events</p></Card></div>
        <Card><h2 className="text-xl font-black">Readiness checklist</h2><div className="mt-4 space-y-3">{checks.map((check) => <div key={check.label} className="flex items-center justify-between rounded-2xl border p-4"><div><div className="font-black">{check.label}</div><div className="text-sm text-slate-500">{check.description}</div></div><span className={check.complete ? "text-emerald-600 font-black" : "text-amber-600 font-black"}>{check.complete ? "Ready" : "Needs setup"}</span></div>)}</div></Card>
      </div>
    </AppShell>
  );
}
