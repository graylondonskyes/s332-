import Link from "next/link";
import { JOBPING_PLANS } from "@/lib/plans";

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#f8fafc,#eef2ff,#ffffff)] px-4 py-12 text-slate-950">
      <section className="mx-auto max-w-6xl">
        <Link href="/" className="font-black">JobPing</Link>
        <div className="mt-10 text-center">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-indigo-700">Profit-safe launch pricing</p>
          <h1 className="mt-3 text-5xl font-black tracking-tight">Clear value. Hard usage guardrails.</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">Built for local operators that need faster lead response and review momentum with strict SMS cost controls or bloated CRM pricing.</p>
        </div>
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {Object.entries(JOBPING_PLANS).map(([key, plan]) => (
            <div key={key} className="rounded-[2rem] border border-white/80 bg-white p-7 shadow-[0_30px_90px_rgba(15,23,42,0.12)]">
              <div className="rounded-full bg-indigo-50 px-4 py-2 text-center text-sm font-black text-indigo-700">{plan.name}</div>
              <div className="mt-6 flex items-end justify-center gap-2"><span className="text-5xl font-black">${plan.monthlyPrice}</span><span className="pb-2 font-bold text-slate-500">/month</span></div>
              <p className="mt-2 text-center text-sm text-slate-500">${plan.setupFee} setup</p>
              <ul className="mt-8 space-y-3 text-sm font-semibold text-slate-700">
                <li className="rounded-2xl bg-slate-50 p-3">✓ {plan.includedSmsSegments.toLocaleString()} SMS segments/month</li>
                <li className="rounded-2xl bg-slate-50 p-3">✓ {plan.includedAiActions} AI assists/month</li>
                <li className="rounded-2xl bg-slate-50 p-3">✓ {plan.users}</li>
                <li className="rounded-2xl bg-slate-50 p-3">✓ {plan.locations}</li>
                <li className="rounded-2xl bg-slate-50 p-3">✓ Overage: ${Number(plan.smsOverageCents / 100).toFixed(2)} per extra SMS segment if enabled</li>
              </ul>
              <p className="mt-5 text-sm text-slate-600">{plan.description}</p>
              <Link href="/signup" className="mt-8 block rounded-2xl bg-slate-950 px-5 py-4 text-center font-black text-white">Start trial</Link>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-3xl text-center text-sm text-slate-600">No uncapped SMS language. Accounts warn at usage thresholds, stop or require overage acceptance at limits, and cancel queued sends when contacts opt out.</p>
      </section>
    </main>
  );
}
