import { AppShell } from "@/components/shared/app-shell";

const screens = [
  ["Public", "Landing, pricing, signup, login, legal/SMS terms"],
  ["Setup", "Onboarding, niche pack selection, messaging policy acknowledgement"],
  ["Operate", "Dashboard, leads, lead detail, templates, automations, billing"],
  ["Protect", "Risk controls, usage meters, admin diagnostics, trust center"],
  ["Support", "Help center, support tickets, walkthrough, exports"]
];

const controls = [
  "Signup/login submit controls",
  "Onboarding completion and template-pack selection",
  "Lead create, status change, note add, retry, and cancel flows",
  "Template save and automation rule update flows",
  "Billing checkout/manage routes",
  "Admin billing override, queued-send cancellation, and diagnostics",
  "Support ticket creation and help-center access",
  "Risk control settings and usage visibility"
];

export default function UiReadinessPage() {
  return (
    <AppShell>
      <div className="space-y-8">
        <section className="rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-xl">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-indigo-700">UI readiness</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">Customer-ready screen contract</h1>
          <p className="mt-3 max-w-3xl text-slate-600">This page defines the app surfaces that must be browser-smoked before launch. It exists so UI readiness is not a vague claim.</p>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {screens.map(([title, body]) => (
            <div key={title} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-black text-slate-950">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
            </div>
          ))}
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-black text-slate-950">Required interactive control proof</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {controls.map((control) => (
              <div key={control} className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-700">{control}</div>
            ))}
          </div>
          <p className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">Until Playwright/browser smoke passes on desktop and mobile dimensions, the honest claim is polished UI surfaces are code-added, not fully customer-proven.</p>
        </section>
      </div>
    </AppShell>
  );
}
