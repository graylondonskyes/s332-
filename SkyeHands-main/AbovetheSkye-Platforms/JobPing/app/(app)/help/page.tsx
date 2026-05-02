import Link from "next/link";
import { AppShell } from "@/components/shared/app-shell";
import { getSupportEmail } from "@/lib/support";

const sections = [
  { title: "Setup health", items: ["Business profile must be complete.", "Review URL must be saved before review requests are useful.", "Templates must be enabled before automation can send copy.", "Provider keys must be present before live SMS/email sends can succeed."] },
  { title: "Lead workflow", items: ["New leads appear in the lead inbox.", "Each lead has a timeline, notes, status controls, and message history.", "Completed leads can trigger review requests.", "Lost leads stop future standard follow-ups."] },
  { title: "Automation transparency", items: ["Queued does not mean sent.", "Failed sends show a reason.", "Skipped sends are logged instead of hidden.", "Disabled rules do not fire."] },
  { title: "Billing and access", items: ["Trial and active accounts can operate.", "Past-due and canceled accounts are blocked from new sends unless a support override is applied.", "Stripe checkout and portal require live dashboard setup."] },
];

export default function HelpPage() {
  const supportEmail = getSupportEmail();
  return (
    <AppShell>
      <div className="space-y-6">
        <section className="rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-xl">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-indigo-700">Help center</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight">Transparent operating guide for owners and support.</h1>
          <p className="mt-2 max-w-3xl text-slate-600">This page explains what each working lane does, what has to be configured, and why a message or automation may be blocked.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/walkthrough" className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white">Open walkthrough</Link>
            <a href={`mailto:${supportEmail}?subject=JobPing help request`} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800">Email {supportEmail}</a>
          </div>
        </section>
        <section className="grid gap-5 md:grid-cols-2">
          {sections.map((section) => (
            <article key={section.title} className="rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-xl">
              <h2 className="text-xl font-black">{section.title}</h2>
              <ul className="mt-4 space-y-3">
                {section.items.map((item) => <li key={item} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">{item}</li>)}
              </ul>
            </article>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
