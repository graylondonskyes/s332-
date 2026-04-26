import { AppShell } from "@/components/shared/app-shell";
import { Card } from "@/components/shared/card";
import { requireAccountUser } from "@/lib/auth";
import { getValueReport } from "@/lib/value-report";

export default async function ValueReportPage() {
  const user = await requireAccountUser();
  const report = await getValueReport(user.accountId!);
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-600">Retention proof</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight">Monthly value report</h1>
          <p className="mt-2 max-w-3xl text-slate-600">A customer-facing proof surface that explains what JobPing did this month without guaranteeing results or overstating booked revenue.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <Card><div className="text-sm font-bold text-slate-500">Period</div><div className="mt-2 text-3xl font-black">{report.periodKey}</div></Card>
          <Card><div className="text-sm font-bold text-slate-500">Booked / completed</div><div className="mt-2 text-3xl font-black">{report.booked} / {report.completed}</div></Card>
          <Card><div className="text-sm font-bold text-slate-500">Messages sent</div><div className="mt-2 text-3xl font-black">{report.messageCounts.sent || 0}</div></Card>
          <Card><div className="text-sm font-bold text-slate-500">SMS segments</div><div className="mt-2 text-3xl font-black">{report.smsSegments}</div></Card>
        </div>
        <Card>
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div>
              <h2 className="text-2xl font-black">Conservative ROI estimate</h2>
              <p className="mt-3 text-slate-600">This estimate is intentionally cautious: it assumes one recovered job per 12 sent messages and uses a default ${report.conservativeJobValue} job value. It is a retention/sales aid, not a guarantee.</p>
              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <div className="rounded-3xl bg-emerald-50 p-5"><div className="text-sm font-bold text-emerald-700">Recovered-job assumption</div><div className="mt-2 text-3xl font-black">{report.assumedRecoveredJobs}</div></div>
                <div className="rounded-3xl bg-indigo-50 p-5"><div className="text-sm font-bold text-indigo-700">Estimated value</div><div className="mt-2 text-3xl font-black">${report.estimatedRecoveredRevenue.toLocaleString()}</div></div>
                <div className="rounded-3xl bg-slate-100 p-5"><div className="text-sm font-bold text-slate-700">Plan ROI multiple</div><div className="mt-2 text-3xl font-black">{report.estimatedRoi}x</div></div>
              </div>
            </div>
            <div className="rounded-3xl bg-slate-950 p-6 text-white">
              <div className="text-sm font-black uppercase tracking-[0.22em] text-emerald-300">Owner script</div>
              <p className="mt-4 text-sm leading-6 text-slate-200">“This month JobPing responded, followed up, and asked for reviews automatically. Here is the activity trail and conservative value estimate. The system does not promise booked jobs; it proves the work it performed.”</p>
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
