"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const packs = [
  { id: "plumbing", name: "Plumbing", description: "Emergency repairs, quote follow-up, review requests." },
  { id: "hvac", name: "HVAC", description: "AC/heating calls, comfort language, estimate follow-up." },
  { id: "cleaning", name: "Cleaning", description: "Booking requests, recurring work, post-clean reviews." },
  { id: "detailing", name: "Mobile Detailing", description: "Vehicle info capture, appointment follow-up, review asks." },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    businessName: "",
    niche: "plumbing",
    templatePackId: "plumbing",
    businessPhone: "",
    replyEmail: "",
    reviewUrl: "",
    serviceArea: "",
    timezone: "America/Phoenix",
    acceptsMessagingPolicy: false,
  });
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const response = await fetch("/api/onboarding/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await response.json();
    if (!response.ok) {
      setError(json.error || "Failed to complete onboarding.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#f8fafc,#eef2ff,#ffffff)] px-4 py-12 text-slate-950">
      <section className="mx-auto max-w-5xl">
        <div className="mb-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-indigo-700">Revenue setup</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight">Finish the business profile and install a niche template pack.</h1>
          <p className="mt-2 max-w-2xl text-slate-600">The account becomes usable immediately after this step: settings, templates, automations, and dashboard are all initialized.</p>
        </div>
        <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <div className="rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-xl">
            <h2 className="text-2xl font-black">Business details</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <input className="jp-input" placeholder="Business name" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
              <input className="jp-input" placeholder="Business phone" value={form.businessPhone} onChange={(e) => setForm({ ...form, businessPhone: e.target.value })} />
              <input className="jp-input" placeholder="Reply email" value={form.replyEmail} onChange={(e) => setForm({ ...form, replyEmail: e.target.value })} />
              <input className="jp-input" placeholder="Service area" value={form.serviceArea} onChange={(e) => setForm({ ...form, serviceArea: e.target.value })} />
              <input className="jp-input md:col-span-2" placeholder="Google review URL" value={form.reviewUrl} onChange={(e) => setForm({ ...form, reviewUrl: e.target.value })} />
              <input className="jp-input md:col-span-2" placeholder="Timezone" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
            </div>
            <label className="mt-5 flex gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm font-semibold leading-6 text-slate-700">
              <input
                type="checkbox"
                required
                checked={form.acceptsMessagingPolicy}
                onChange={(e) => setForm({ ...form, acceptsMessagingPolicy: e.target.checked })}
                className="mt-1 h-4 w-4"
              />
              <span>
                I understand automated SMS requires customer consent, STOP/START must be honored, usage limits are enforced, and JobPing is not an unlimited marketing-blast system.
                <a className="ml-1 font-black text-indigo-700" href="/legal/sms-terms" target="_blank">Read SMS terms.</a>
              </span>
            </label>
            {error ? <p className="mt-4 rounded-2xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
            <button className="mt-6 w-full rounded-2xl bg-slate-950 px-5 py-4 font-black text-white">Complete setup</button>
          </div>
          <div className="rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-xl">
            <h2 className="text-2xl font-black">Template pack</h2>
            <p className="mt-1 text-sm text-slate-500">Choose the copy set that installs into welcome, missed-call, follow-up, quote, and review workflows.</p>
            <div className="mt-5 space-y-3">
              {packs.map((pack) => (
                <label key={pack.id} className={`block cursor-pointer rounded-2xl border p-4 transition ${form.templatePackId === pack.id ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white hover:border-indigo-200"}`}>
                  <input
                    type="radio"
                    name="templatePackId"
                    className="sr-only"
                    checked={form.templatePackId === pack.id}
                    onChange={() => setForm({ ...form, templatePackId: pack.id, niche: pack.id })}
                  />
                  <span className="font-black">{pack.name}</span>
                  <span className="mt-1 block text-sm text-slate-600">{pack.description}</span>
                </label>
              ))}
            </div>
          </div>
        </form>
      </section>
    </main>
  );
}
