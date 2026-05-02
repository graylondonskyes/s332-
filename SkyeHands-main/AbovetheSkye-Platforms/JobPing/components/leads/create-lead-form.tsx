"use client";

import { useState } from "react";
import { Button } from "@/components/shared/button";

export function CreateLeadForm() {
  const [state, setState] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    serviceType: "",
    source: "manual",
    notes: "",
  });
  const [message, setMessage] = useState<string | null>(null);

  async function submit(formData: FormData) {
    const payload = Object.fromEntries(formData.entries());
    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await response.json();
    setMessage(response.ok ? "Lead created." : json.error || "Failed to create lead.");
    if (response.ok) {
      setState({ firstName: "", lastName: "", phone: "", email: "", serviceType: "", source: "manual", notes: "" });
      window.location.reload();
    }
  }

  return (
    <form action={submit} className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm md:grid-cols-2">
      <input name="firstName" value={state.firstName} onChange={(e) => setState({ ...state, firstName: e.target.value })} placeholder="First name" className="rounded-lg border px-3 py-2" />
      <input name="lastName" value={state.lastName} onChange={(e) => setState({ ...state, lastName: e.target.value })} placeholder="Last name" className="rounded-lg border px-3 py-2" />
      <input name="phone" value={state.phone} onChange={(e) => setState({ ...state, phone: e.target.value })} placeholder="Phone" className="rounded-lg border px-3 py-2" />
      <input name="email" value={state.email} onChange={(e) => setState({ ...state, email: e.target.value })} placeholder="Email" className="rounded-lg border px-3 py-2" />
      <input name="serviceType" value={state.serviceType} onChange={(e) => setState({ ...state, serviceType: e.target.value })} placeholder="Service type" className="rounded-lg border px-3 py-2" />
      <input name="source" value={state.source} onChange={(e) => setState({ ...state, source: e.target.value })} placeholder="Source" className="rounded-lg border px-3 py-2" />
      <textarea name="notes" value={state.notes} onChange={(e) => setState({ ...state, notes: e.target.value })} placeholder="Notes" className="rounded-lg border px-3 py-2 md:col-span-2" rows={4} />
      <div className="md:col-span-2 flex items-center justify-between">
        <p className="text-sm text-zinc-500">Phone or email is required.</p>
        <Button type="submit">Create lead</Button>
      </div>
      {message ? <p className="md:col-span-2 text-sm text-zinc-600">{message}</p> : null}
    </form>
  );
}
