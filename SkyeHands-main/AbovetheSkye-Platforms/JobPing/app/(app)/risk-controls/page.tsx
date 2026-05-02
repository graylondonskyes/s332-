import { AppShell } from "@/components/shared/app-shell";
import { Card } from "@/components/shared/card";
import { requireAccountUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SettingsForm } from "@/components/operations/action-forms";

export default async function RiskControlsPage() {
  const user = await requireAccountUser();
  const account = await prisma.account.findUnique({ where: { id: user.accountId! }, include: { settings: true } });
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.22em] text-rose-600">Cost and compliance protection</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight">Automation risk controls</h1>
          <p className="mt-2 max-w-3xl text-slate-600">Protect margin and customer trust with quiet hours, daily automated SMS ceilings, per-lead cooldowns, and failed-send safeguards.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <Card><div className="text-sm font-bold text-slate-500">Quiet hours</div><div className="mt-2 text-2xl font-black">{account?.settings?.quietHoursStart || "20:00"}–{account?.settings?.quietHoursEnd || "08:00"}</div></Card>
          <Card><div className="text-sm font-bold text-slate-500">Daily SMS ceiling</div><div className="mt-2 text-2xl font-black">{account?.settings?.dailyAutomatedSmsLimit ?? 75}</div></Card>
          <Card><div className="text-sm font-bold text-slate-500">Lead cooldown</div><div className="mt-2 text-2xl font-black">{account?.settings?.leadCooldownHours ?? 18}h</div></Card>
          <Card><div className="text-sm font-bold text-slate-500">Failed-send pause</div><div className="mt-2 text-2xl font-black">{account?.settings?.autoPauseFailedSends ?? true ? "On" : "Off"}</div></Card>
        </div>
        <Card>
          <h2 className="text-2xl font-black">Edit safety controls</h2>
          <p className="mt-2 text-sm text-slate-600">These settings are saved on the account settings row and checked before automated SMS queues/sends.</p>
          <div className="mt-5"><SettingsForm account={account} /></div>
        </Card>
      </div>
    </AppShell>
  );
}
