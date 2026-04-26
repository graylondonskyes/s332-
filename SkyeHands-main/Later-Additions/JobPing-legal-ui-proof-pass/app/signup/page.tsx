"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form.entries())),
    });
    const json = await response.json();
    if (!response.ok) return setError(json.error || "Signup failed.");
    router.push("/onboarding");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#dbeafe,transparent_32%),linear-gradient(135deg,#f8fafc,#ffffff)] px-4 py-12 text-slate-950">
      <section className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[2rem] bg-slate-950 p-8 text-white shadow-2xl">
          <Link href="/" className="font-black">JobPing</Link>
          <h1 className="mt-10 text-5xl font-black tracking-tight">Set up the lead engine customers can pay for.</h1>
          <p className="mt-4 text-slate-300">Create the workspace, choose the niche pack, and get the account ready for first leads, follow-ups, and review requests.</p>
          <div className="mt-8 space-y-3 text-sm font-semibold text-slate-200">
            <div className="rounded-2xl bg-white/10 p-4">✓ Tenant-safe workspace</div>
            <div className="rounded-2xl bg-white/10 p-4">✓ Seeded automations</div>
            <div className="rounded-2xl bg-white/10 p-4">✓ Billing state enforcement</div>
          </div>
        </div>
        <form onSubmit={onSubmit} className="rounded-[2rem] border border-white/80 bg-white/90 p-8 shadow-[0_30px_90px_rgba(15,23,42,0.12)] backdrop-blur">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-indigo-700">Start account</p>
          <h2 className="mt-2 text-3xl font-black">Create your workspace</h2>
          <div className="mt-6 grid gap-4">
            <input name="fullName" required minLength={2} placeholder="Owner full name" className="jp-input" />
            <input name="businessName" required minLength={2} placeholder="Business name" className="jp-input" />
            <input name="email" required type="email" placeholder="Email" className="jp-input" />
            <input name="password" required type="password" minLength={8} placeholder="Password" className="jp-input" />
          </div>
          {error ? <p className="mt-4 rounded-2xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
          <button className="mt-6 w-full rounded-2xl bg-slate-950 px-5 py-4 font-black text-white">Create workspace</button>
          <p className="mt-4 text-center text-xs leading-5 text-slate-500">By creating a workspace, you agree to the <Link href="/legal/terms" className="font-bold text-indigo-700">Terms</Link>, <Link href="/legal/privacy" className="font-bold text-indigo-700">Privacy Policy</Link>, and <Link href="/legal/sms-terms" className="font-bold text-indigo-700">SMS Terms</Link>.</p>
          <p className="mt-3 text-center text-sm text-slate-500">Already have an account? <Link href="/login" className="font-bold text-indigo-700">Log in</Link></p>
        </form>
      </section>
    </main>
  );
}
