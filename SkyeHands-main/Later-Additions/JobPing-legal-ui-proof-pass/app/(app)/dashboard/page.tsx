import { AppShell } from "@/components/shared/app-shell";
import { MetricsRow } from "@/components/dashboard/metrics-row";
import { Card } from "@/components/shared/card";
import { requireAccountUser } from "@/lib/auth";
import { getDashboardSummary } from "@/lib/dashboard";

export default async function DashboardPage() {
  const user = await requireAccountUser();
  const summary = await getDashboardSummary(user.accountId!);

  const counts = Object.fromEntries(summary.leadCounts.map((item) => [item.status, item._count]));
  const messageCounts = Object.fromEntries(summary.messageStats.map((item) => [item.status, item._count]));

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="mt-1 text-zinc-600">Welcome back, {user.fullName ?? user.email}.</p>
        </div>
        <MetricsRow
          items={[
            { label: "New leads", value: counts.new ?? 0 },
            { label: "Booked", value: counts.booked ?? 0 },
            { label: "Completed", value: counts.completed ?? 0 },
            { label: "Messages sent", value: messageCounts.sent ?? 0 },
          ]}
        />
        <Card>
          <h2 className="text-xl font-semibold">Recent activity</h2>
          <div className="mt-4 space-y-3">
            {summary.recentActivity.length === 0 ? <p className="text-sm text-zinc-500">No activity yet.</p> : null}
            {summary.recentActivity.map((item) => (
              <div key={item.id} className="rounded-lg border border-zinc-200 p-3">
                <div className="font-medium">{item.eventLabel}</div>
                <div className="text-sm text-zinc-500">{item.eventType} • {item.createdAt.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
