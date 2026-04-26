import { AppShell } from "@/components/shared/app-shell";
import { Card } from "@/components/shared/card";
import { requireAccountUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SavedViewForm } from "@/components/operations/action-forms";
import { ensureAccountIntakeToken } from "@/lib/intake-token";

export default async function SavedViewsPage() {
  const user = await requireAccountUser();
  const views = await prisma.savedView.findMany({ where: { accountId: user.accountId! }, orderBy: { createdAt: "desc" } });
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://your-jobping-domain.example";
  const tokenState = await ensureAccountIntakeToken(user.accountId!);
  const token = tokenState.token || "ROTATE-TOKEN-FROM-/api/embed/rotate-token-TO-REVEAL-A-FRESH-VALUE";
  const snippet = `<form method="post" action="${baseUrl}/api/public/leads" data-jobping-lead-form>\n  <input type="hidden" name="intakeToken" value="${token}" />\n  <input name="firstName" placeholder="First name" required />\n  <input name="phone" placeholder="Phone" required />\n  <input name="email" placeholder="Email" />\n  <input name="serviceType" placeholder="Service needed" />\n  <textarea name="notes" placeholder="Tell us what you need"></textarea>\n  <label><input type="checkbox" name="smsConsent" required /> I agree to receive follow-up messages about my request.</label>\n  <button type="submit">Request a callback</button>\n</form>`;
  return (
    <AppShell>
      <div className="space-y-6">
        <div><p className="text-sm font-black uppercase tracking-[0.22em] text-indigo-600">Lead operations</p><h1 className="mt-2 text-4xl font-black tracking-tight">Saved views and capture embed</h1><p className="mt-2 max-w-3xl text-slate-600">Store useful lead filters and copy a token-protected website form for inbound leads. The token is not the account id and can be rotated.</p></div>
        <Card><SavedViewForm /></Card>
        <Card><h2 className="text-xl font-black">Views</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{views.length === 0 ? <p className="text-sm text-slate-500">No saved views yet.</p> : null}{views.map((view) => <div key={view.id} className="rounded-2xl border p-4"><div className="font-black">{view.name}</div><pre className="mt-2 overflow-auto text-xs text-slate-500">{JSON.stringify(view.filtersJson, null, 2)}</pre></div>)}</div></Card>
        <Card><h2 className="text-xl font-black">Website lead form snippet</h2><p className="mt-1 text-sm text-slate-600">Paste this into a customer site when you want the public intake API to create JobPing leads. Current intake token ending: {tokenState.last4}. Rotate the token if this snippet is exposed.</p><pre className="mt-4 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-white">{snippet}</pre></Card>
      </div>
    </AppShell>
  );
}
