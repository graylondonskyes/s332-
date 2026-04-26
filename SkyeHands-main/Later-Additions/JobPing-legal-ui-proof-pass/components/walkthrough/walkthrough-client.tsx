"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const steps = [
  { title: "1. Finish revenue setup", route: "/onboarding", screen: "Onboarding", cta: "Open onboarding", body: "Enter the business profile, review URL, reply email, timezone, and niche template pack. JobPing then installs usable templates and automation rules.", proof: ["Business profile saved", "Template pack installed", "Automation defaults enabled"] },
  { title: "2. Capture a lead", route: "/leads", screen: "Lead Inbox", cta: "Open leads", body: "Create a lead with name, phone or email, service type, source, and notes. The lead is stored under the current account and becomes available for automation.", proof: ["Lead persists", "Timeline starts", "First response can queue"] },
  { title: "3. Read the activity timeline", route: "/leads", screen: "Lead Detail", cta: "Open lead inbox", body: "Open the lead detail page to see status changes, notes, queued messages, sent messages, failures, skipped actions, and review request activity.", proof: ["Status changes logged", "Message events visible", "Failures explain why"] },
  { title: "4. Edit templates", route: "/templates", screen: "Templates", cta: "Open templates", body: "Update welcome, missed-call, follow-up, quote, and review request copy. Variables are limited to safe known values.", proof: ["Editable copy", "Niche language", "Template safeguards"] },
  { title: "5. Control automation", route: "/automations", screen: "Automations", cta: "Open automations", body: "Turn rules on or off and adjust delays. Disabled rules do not fire, and skipped actions are logged instead of hidden.", proof: ["Instant reply toggle", "Follow-up delays", "Review trigger"] },
  { title: "6. Support failures", route: "/admin", screen: "Support Console", cta: "Open support console", body: "Admin users can review failed sends, provider events, billing state, and queued messages. This gives support a real operating surface.", proof: ["Failed-send diagnostics", "Billing support tools", "Cancel queued sends"] },
  { title: "7. Confirm billing access", route: "/billing", screen: "Billing", cta: "Open billing", body: "The billing page shows subscription state and routes customers to checkout or the customer portal. Sends are blocked when access is not allowed.", proof: ["Trial/active allowed", "Past-due blocked", "Portal route available"] },
];

export function WalkthroughClient({ supportEmail }: { supportEmail: string }) {
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const progress = useMemo(() => Math.round(((index + 1) / steps.length) * 100), [index]);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-xl">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-indigo-700">Operator walkthrough</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl font-black tracking-tight">Walk the customer journey with changing screens.</h1>
            <p className="mt-2 max-w-3xl text-slate-600">Each step changes this walkthrough screen, explains the working surface, and links to the real app page that handles the workflow.</p>
          </div>
          <a className="rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3 text-sm font-black text-white" href={`mailto:${supportEmail}?subject=JobPing support request`}>Email support</a>
        </div>
        <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} /></div>
        <p className="mt-2 text-sm font-bold text-slate-500">Step {index + 1} of {steps.length} · {progress}% complete</p>
      </section>
      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="rounded-[2rem] border border-white/80 bg-white/90 p-4 shadow-xl">
          <div className="space-y-2">{steps.map((item, itemIndex) => <button key={item.title} onClick={() => setIndex(itemIndex)} className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-black transition ${itemIndex === index ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"}`}>{item.title}</button>)}</div>
        </aside>
        <article className="overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-950 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 text-white"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-200">{step.screen}</p><h2 className="text-2xl font-black">{step.title}</h2></div><div className="flex gap-2"><span className="h-3 w-3 rounded-full bg-rose-400" /><span className="h-3 w-3 rounded-full bg-amber-300" /><span className="h-3 w-3 rounded-full bg-emerald-400" /></div></div>
          <div className="grid gap-5 p-5 md:grid-cols-[1fr_0.8fr]">
            <div className="rounded-3xl bg-white p-5 text-slate-950">
              <p className="text-sm font-semibold text-slate-600">{step.body}</p>
              <div className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50 p-4"><p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-700">What changes on screen</p><div className="mt-3 space-y-2">{step.proof.map((item) => <div key={item} className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm">✓ {item}</div>)}</div></div>
              <div className="mt-5 flex flex-wrap gap-3"><button disabled={index === 0} onClick={() => setIndex((value) => Math.max(0, value - 1))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black disabled:opacity-40">Previous</button><button disabled={index === steps.length - 1} onClick={() => setIndex((value) => Math.min(steps.length - 1, value + 1))} className="rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-black text-white disabled:opacity-40">Next screen</button><Link href={step.route} className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white">{step.cta}</Link></div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/10 p-5 text-white"><p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-200">Operator clarity</p><h3 className="mt-2 text-xl font-black">What the customer should understand</h3><p className="mt-3 text-sm text-slate-200">JobPing is transparent by design: the owner sees what is enabled, what fired, what was blocked, what failed, and what to do next.</p><div className="mt-5 rounded-2xl bg-slate-900 p-4 text-sm text-slate-200"><p className="font-black text-white">Support contact</p><a className="mt-1 block break-all text-indigo-200 underline" href={`mailto:${supportEmail}?subject=JobPing walkthrough support`}>{supportEmail}</a></div></div>
          </div>
        </article>
      </section>
    </div>
  );
}
