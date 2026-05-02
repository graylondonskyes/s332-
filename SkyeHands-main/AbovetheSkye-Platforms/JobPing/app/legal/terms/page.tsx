import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-950">
      <section className="mx-auto max-w-4xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-indigo-700">Terms</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Terms of Service</h1>
        <p className="mt-4 text-slate-600">JobPing provides lead follow-up, operational messaging, message logging, usage guardrails, and review-request automation for business users. It is not a full CRM, call-center replacement, or guaranteed-booking product.</p>
        <h2 className="mt-8 text-2xl font-black">Messaging use</h2>
        <p className="mt-2 text-slate-600">Businesses must only send messages to contacts they have permission to contact. Automated SMS requires consent. STOP/START instructions must be honored. Imported-contact blasting and deceptive message content are not allowed.</p>
        <h2 className="mt-8 text-2xl font-black">Billing and usage limits</h2>
        <p className="mt-2 text-slate-600">Access depends on subscription state. Plan limits apply to SMS segments, AI usage, and supported features. When limits are reached, JobPing may block, pause, or require approved overages before additional sends occur.</p>
        <h2 className="mt-8 text-2xl font-black">Provider configuration</h2>
        <p className="mt-2 text-slate-600">Billing, SMS, email, AI, and scheduler features require properly configured provider accounts, live environment variables, deployed webhook URLs, and live smoke proof. Provider failures may delay or block automation.</p>
        <h2 className="mt-8 text-2xl font-black">No guarantee of results</h2>
        <p className="mt-2 text-slate-600">JobPing helps businesses respond faster and follow up more consistently, but it does not guarantee booked jobs, reviews, revenue, deliverability, or legal compliance outcomes.</p>
        <div className="mt-8 flex flex-wrap gap-3 text-sm font-bold"><Link href="/legal/sms-terms" className="rounded-full border border-slate-200 px-4 py-2">SMS Terms</Link><Link href="/legal/privacy" className="rounded-full border border-slate-200 px-4 py-2">Privacy</Link></div>
      </section>
    </main>
  );
}
