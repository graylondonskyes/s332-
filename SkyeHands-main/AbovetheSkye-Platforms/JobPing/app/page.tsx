import Link from "next/link";

const proof = ["Instant lead reply", "Missed-call recovery", "Follow-up sequence", "Review request automation"];
const niches = ["Plumbing", "HVAC", "Cleaning", "Mobile detailing"];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,#dbeafe,transparent_30%),radial-gradient(circle_at_top_right,#ede9fe,transparent_28%),linear-gradient(135deg,#f8fafc,#eef2ff_45%,#ffffff)] text-slate-950">
      <section className="mx-auto max-w-7xl px-4 py-8">
        <nav className="flex items-center justify-between rounded-full border border-white/70 bg-white/80 px-5 py-3 shadow-xl backdrop-blur">
          <Link href="/" className="font-black tracking-tight">JobPing</Link>
          <div className="flex items-center gap-3 text-sm font-bold">
            <Link href="/pricing" className="text-slate-600 hover:text-slate-950">Pricing</Link>
            <Link href="/login" className="text-slate-600 hover:text-slate-950">Login</Link>
            <Link href="/signup" className="rounded-full bg-slate-950 px-4 py-2 text-white">Start trial</Link>
          </div>
        <Link href="/legal/sms-terms" className="hidden text-xs font-bold text-slate-500 md:inline">SMS policy</Link>
        </nav>

        <div className="grid items-center gap-10 py-20 lg:grid-cols-[1.08fr_0.92fr]">
          <div>
            <p className="inline-flex rounded-full border border-indigo-200 bg-white/80 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-indigo-700 shadow-sm">Built for local service operators</p>
            <h1 className="mt-6 max-w-4xl text-5xl font-black tracking-[-0.05em] sm:text-6xl lg:text-7xl">Turn missed leads into booked jobs and fresh reviews.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">JobPing gives home-service businesses a focused response engine: capture the lead, reply immediately, follow up cleanly, and ask for the review after the job is complete.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" className="rounded-2xl bg-slate-950 px-6 py-4 text-center font-black text-white shadow-2xl shadow-slate-300">Start the paid trial</Link>
              <Link href="/pricing" className="rounded-2xl border border-slate-200 bg-white/80 px-6 py-4 text-center font-black text-slate-900 shadow-lg">See launch pricing</Link>
            </div>
            <p className="mt-4 text-sm text-slate-500">Launch plan: $99/month plus optional setup. Includes strict SMS fair-use limits and opt-out protection so costs do not run wild.</p>
          </div>

          <div className="rounded-[2rem] border border-white/80 bg-white/82 p-5 shadow-[0_30px_90px_rgba(15,23,42,0.16)] backdrop-blur">
            <div className="rounded-[1.5rem] bg-slate-950 p-5 text-white">
              <div className="flex items-center justify-between"><span className="text-sm font-bold text-indigo-200">Live workflow</span><span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-bold text-emerald-200">Chargeable v1</span></div>
              <div className="mt-5 space-y-3">
                {proof.map((item, index) => (
                  <div key={item} className="rounded-2xl bg-white/10 p-4">
                    <div className="text-xs font-black uppercase tracking-widest text-slate-400">Step {index + 1}</div>
                    <div className="mt-1 text-lg font-black">{item}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {niches.map((niche) => <div key={niche} className="rounded-2xl bg-slate-100 p-4 text-sm font-bold text-slate-700">{niche}</div>)}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
