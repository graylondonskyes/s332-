import Link from "next/link";

const bullets = [
  "Messages are sent only for service follow-up, quote coordination, appointment-related updates, and review requests connected to a customer inquiry or job.",
  "Customers must provide permission before receiving automated SMS. JobPing records consent source, timestamp, and phone number where available.",
  "Message frequency varies by business and lead activity. The default fair-use cap is 500 SMS segments per business per month on Starter unless a higher plan or approved overage is enabled.",
  "Reply STOP to opt out. Reply START to opt back in. HELP may provide support instructions when the provider route is configured.",
  "Message and data rates may apply. Carriers are not liable for delayed or undelivered messages.",
  "Businesses are responsible for only contacting people who have consented and for keeping their own records accurate."
];

export default function SmsTermsPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-950">
      <section className="mx-auto max-w-4xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-indigo-700">Messaging terms</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">SMS Terms and Consent Policy</h1>
        <p className="mt-4 text-slate-600">
          JobPing supports operational SMS for businesses that respond to leads, follow up on service inquiries, coordinate quotes, and request reviews after completed work. SMS is not unlimited and is not a blast-marketing tool.
        </p>
        <div className="mt-8 grid gap-4">
          {bullets.map((item) => (
            <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-700">{item}</div>
          ))}
        </div>
        <h2 className="mt-8 text-2xl font-black">Opt-out handling</h2>
        <p className="mt-2 text-slate-600">
          When a contact replies STOP, JobPing records the opt-out, blocks future automated SMS to that phone number, cancels pending queued SMS to that number, and requires START before SMS may resume.
        </p>
        <h2 className="mt-8 text-2xl font-black">Fair-use limits</h2>
        <p className="mt-2 text-slate-600">
          Plans include a defined monthly SMS segment allowance. JobPing reserves usage before sending and blocks or pauses sends that would exceed plan limits unless approved overages are enabled.
        </p>
        <h2 className="mt-8 text-2xl font-black">Customer responsibility</h2>
        <p className="mt-2 text-slate-600">
          Each business using JobPing must collect lawful consent, use accurate message content, honor opt-outs, and avoid imported-contact blasting. This page is product copy and operating policy, not a substitute for legal counsel.
        </p>
        <div className="mt-8 flex flex-wrap gap-3 text-sm font-bold">
          <Link href="/legal/privacy" className="rounded-full border border-slate-200 px-4 py-2">Privacy Policy</Link>
          <Link href="/legal/terms" className="rounded-full border border-slate-200 px-4 py-2">Terms of Service</Link>
        </div>
      </section>
    </main>
  );
}
