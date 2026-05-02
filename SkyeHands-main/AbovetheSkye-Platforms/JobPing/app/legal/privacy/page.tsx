import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-950">
      <section className="mx-auto max-w-4xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-indigo-700">Privacy</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Privacy Policy</h1>
        <p className="mt-4 text-slate-600">JobPing stores the minimum records needed to operate a lead response and review-request service: account details, users, leads, message templates, consent records, opt-out records, usage ledgers, billing events, audit events, and support events.</p>
        <h2 className="mt-8 text-2xl font-black">Tenant isolation</h2>
        <p className="mt-2 text-slate-600">Lead, message, billing, and consent records are scoped to the business account that owns them. Product code must query operational data through the authenticated account context.</p>
        <h2 className="mt-8 text-2xl font-black">Service providers</h2>
        <p className="mt-2 text-slate-600">When configured, JobPing may send operational data to Stripe for billing, Twilio for SMS/call-related messaging, Resend for email, and an AI provider for assistive drafting features. Provider-dependent features must fail visibly when configuration is missing.</p>
        <h2 className="mt-8 text-2xl font-black">Messaging data</h2>
        <p className="mt-2 text-slate-600">JobPing records message status, failure reasons, provider IDs, opt-out activity, and consent metadata so businesses can understand what happened and avoid unauthorized sends.</p>
        <h2 className="mt-8 text-2xl font-black">Exports and deletion support</h2>
        <p className="mt-2 text-slate-600">Business users may export account data through supported product surfaces. Deletion and retention requests should be handled through support using the configured support email.</p>
        <div className="mt-8 flex flex-wrap gap-3 text-sm font-bold"><Link href="/legal/sms-terms" className="rounded-full border border-slate-200 px-4 py-2">SMS Terms</Link><Link href="/legal/terms" className="rounded-full border border-slate-200 px-4 py-2">Terms</Link></div>
      </section>
    </main>
  );
}
