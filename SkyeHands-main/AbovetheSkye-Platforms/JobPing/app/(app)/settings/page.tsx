import { AppShell } from "@/components/shared/app-shell";
import { Card } from "@/components/shared/card";
import { requireAccountUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SettingsForm } from "@/components/operations/action-forms";

export default async function SettingsPage() {
  const user = await requireAccountUser();
  const account = await prisma.account.findUnique({ where: { id: user.accountId! }, include: { settings: true } });
  return (
    <AppShell>
      <div className="space-y-6">
        <div><p className="text-sm font-black uppercase tracking-[0.22em] text-indigo-600">Settings</p><h1 className="mt-2 text-4xl font-black tracking-tight">Business and alert configuration</h1><p className="mt-2 text-slate-600">Keep the charge-ready pieces configurable without hardcoded support or alert inboxes.</p></div>
        <Card>
          <SettingsForm account={account} />
        </Card>
      </div>
    </AppShell>
  );
}
