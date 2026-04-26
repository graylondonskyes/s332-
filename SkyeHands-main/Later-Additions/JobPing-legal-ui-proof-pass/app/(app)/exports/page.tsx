import { AppShell } from "@/components/shared/app-shell";
import { Card } from "@/components/shared/card";
import { requireAccountUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { GenerateExportButton } from "@/components/operations/action-forms";

export default async function ExportsPage() {
  const user = await requireAccountUser();
  const exports = await prisma.backupExport.findMany({ where: { accountId: user.accountId! }, orderBy: { createdAt: "desc" }, take: 20 });
  return (
    <AppShell>
      <div className="space-y-6">
        <div><p className="text-sm font-black uppercase tracking-[0.22em] text-indigo-600">Data control</p><h1 className="mt-2 text-4xl font-black tracking-tight">Portable account exports</h1><p className="mt-2 max-w-3xl text-slate-600">Generate a tenant-scoped JSON export of leads, notes, messages, templates, rules, usage, and account settings.</p></div>
        <Card><GenerateExportButton /></Card>
        <Card><h2 className="text-xl font-black">Export history</h2><div className="mt-4 space-y-3">{exports.length === 0 ? <p className="text-sm text-slate-500">No exports yet.</p> : null}{exports.map((item) => <details key={item.id} className="rounded-2xl border p-4"><summary className="cursor-pointer font-black">{item.exportType} • {item.recordCount} records • {item.createdAt.toLocaleString()}</summary><pre className="mt-3 max-h-96 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-white">{JSON.stringify(item.payloadJson, null, 2)}</pre></details>)}</div></Card>
      </div>
    </AppShell>
  );
}
