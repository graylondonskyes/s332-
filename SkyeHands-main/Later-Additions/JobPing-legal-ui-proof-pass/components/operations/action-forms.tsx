"use client";

import { useState } from "react";

export function SupportTicketForm() {
  const [message, setMessage] = useState("");
  async function submit(formData: FormData) {
    const res = await fetch("/api/support/tickets", { method: "POST", body: formData });
    setMessage(res.ok ? "Support ticket created." : (await res.json()).error || "Ticket failed.");
    if (res.ok) setTimeout(() => window.location.reload(), 600);
  }
  return <form action={submit} className="grid gap-3"><input name="subject" required placeholder="Subject" className="rounded-2xl border px-4 py-3" /><select name="priority" className="rounded-2xl border px-4 py-3"><option value="normal">Normal</option><option value="urgent">Urgent</option></select><textarea name="body" required placeholder="Describe the issue or request" rows={6} className="rounded-2xl border px-4 py-3" /><button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white" type="submit">Create support ticket</button>{message ? <p className="text-sm font-bold text-slate-600">{message}</p> : null}</form>;
}

export function GenerateExportButton() {
  const [message, setMessage] = useState("");
  async function createExport() {
    const res = await fetch("/api/backup/export", { method: "POST" });
    setMessage(res.ok ? "Export generated." : "Export failed.");
    if (res.ok) setTimeout(() => window.location.reload(), 600);
  }
  return <div><button onClick={createExport} className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white" type="button">Generate new export</button>{message ? <p className="mt-3 text-sm font-bold text-slate-600">{message}</p> : null}</div>;
}

export function SavedViewForm() {
  const [message, setMessage] = useState("");
  async function submit(formData: FormData) {
    const res = await fetch("/api/saved-views", { method: "POST", body: formData });
    setMessage(res.ok ? "Saved view created." : (await res.json()).error || "Save failed.");
    if (res.ok) setTimeout(() => window.location.reload(), 600);
  }
  return <form action={submit} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"><input name="name" required placeholder="View name, e.g. New HVAC quotes" className="rounded-2xl border px-4 py-3" /><input name="filters" placeholder='{"status":"new","serviceType":"HVAC"}' className="rounded-2xl border px-4 py-3" /><button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white" type="submit">Save view</button>{message ? <p className="text-sm font-bold text-slate-600 md:col-span-3">{message}</p> : null}</form>;
}

export function SettingsForm({ account }: { account: any }) {
  const [message, setMessage] = useState("");
  async function submit(formData: FormData) {
    const res = await fetch("/api/account", { method: "POST", body: formData });
    setMessage(res.ok ? "Settings saved." : "Settings failed.");
    if (res.ok) setTimeout(() => window.location.reload(), 600);
  }
  return <form action={submit} className="grid gap-4 md:grid-cols-2"><input name="businessName" defaultValue={account?.businessName || ""} placeholder="Business name" className="rounded-2xl border px-4 py-3" /><input name="niche" defaultValue={account?.niche || ""} placeholder="Niche" className="rounded-2xl border px-4 py-3" /><input name="businessPhone" defaultValue={account?.businessPhone || ""} placeholder="Business phone" className="rounded-2xl border px-4 py-3" /><input name="replyEmail" defaultValue={account?.replyEmail || ""} placeholder="Reply email" className="rounded-2xl border px-4 py-3" /><input name="reviewUrl" defaultValue={account?.reviewUrl || ""} placeholder="Review URL" className="rounded-2xl border px-4 py-3" /><input name="serviceArea" defaultValue={account?.serviceArea || ""} placeholder="Service area" className="rounded-2xl border px-4 py-3" /><input name="notificationEmail" defaultValue={account?.settings?.notificationEmail || ""} placeholder="Customer notification email" className="rounded-2xl border px-4 py-3" /><input name="ownerAlertEmail" defaultValue={account?.settings?.ownerAlertEmail || ""} placeholder="Owner/admin alert email" className="rounded-2xl border px-4 py-3" /><label className="flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold"><input type="checkbox" name="dailyDigestEnabled" defaultChecked={account?.settings?.dailyDigestEnabled ?? true} /> Daily digest enabled</label><label className="flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold"><input type="checkbox" name="failedSendAlertsEnabled" defaultChecked={account?.settings?.failedSendAlertsEnabled ?? true} /> Failed-send alerts enabled</label><input name="quietHoursStart" defaultValue={account?.settings?.quietHoursStart || "20:00"} placeholder="Quiet hours start, e.g. 20:00" className="rounded-2xl border px-4 py-3" /><input name="quietHoursEnd" defaultValue={account?.settings?.quietHoursEnd || "08:00"} placeholder="Quiet hours end, e.g. 08:00" className="rounded-2xl border px-4 py-3" /><input name="dailyAutomatedSmsLimit" type="number" min="1" defaultValue={account?.settings?.dailyAutomatedSmsLimit ?? 75} placeholder="Daily automated SMS limit" className="rounded-2xl border px-4 py-3" /><input name="leadCooldownHours" type="number" min="0" defaultValue={account?.settings?.leadCooldownHours ?? 18} placeholder="Lead cooldown hours" className="rounded-2xl border px-4 py-3" /><label className="flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold"><input type="checkbox" name="autoPauseFailedSends" defaultChecked={account?.settings?.autoPauseFailedSends ?? true} /> Auto-pause risky failed sends</label><button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white md:col-span-2" type="submit">Save settings</button>{message ? <p className="text-sm font-bold text-slate-600 md:col-span-2">{message}</p> : null}</form>;
}
