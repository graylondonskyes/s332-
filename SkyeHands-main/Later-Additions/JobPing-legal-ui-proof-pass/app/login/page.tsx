"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form.entries())),
    });
    const json = await response.json();
    if (!response.ok) return setError(json.error || "Login failed.");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#f8fafc,#eef2ff,#ffffff)] px-4 py-12 text-slate-950">
      <form onSubmit={onSubmit} className="mx-auto max-w-md rounded-[2rem] border border-white/80 bg-white/90 p-8 shadow-[0_30px_90px_rgba(15,23,42,0.12)]">
        <Link href="/" className="font-black">JobPing</Link>
        <h1 className="mt-8 text-4xl font-black tracking-tight">Log in</h1>
        <p className="mt-2 text-slate-600">Open your lead-response console.</p>
        <div className="mt-6 grid gap-4">
          <input name="email" type="email" required placeholder="Email" className="jp-input" />
          <input name="password" type="password" required minLength={8} placeholder="Password" className="jp-input" />
        </div>
        {error ? <p className="mt-4 rounded-2xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
        <button className="mt-6 w-full rounded-2xl bg-slate-950 px-5 py-4 font-black text-white">Log in</button>
        <p className="mt-4 text-center text-sm text-slate-500">Need an account? <Link href="/signup" className="font-bold text-indigo-700">Start trial</Link></p>
      </form>
    </main>
  );
}
