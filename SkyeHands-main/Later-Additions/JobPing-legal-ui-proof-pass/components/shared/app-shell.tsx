import Link from "next/link";
import { PropsWithChildren } from "react";
import { getCurrentUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { getSupportEmail } from "@/lib/support";

const links = [
  ["Dashboard", "/dashboard"],
  ["Leads", "/leads"],
  ["Templates", "/templates"],
  ["Automations", "/automations"],
  ["AI Assist", "/ai-assist"],
  ["Settings", "/settings"],
  ["Billing", "/billing"],
  ["Risk Controls", "/risk-controls"],
  ["Value Report", "/value-report"],
  ["Saved Views", "/saved-views"],
  ["Exports", "/exports"],
  ["Support", "/support"],
  ["Trust Center", "/trust-center"],
  ["UI Readiness", "/ui-readiness"],
  ["Walkthrough", "/walkthrough"],
  ["Help", "/help"],
] as const;

export async function AppShell({ children }: PropsWithChildren) {
  const user = await getCurrentUser();
  const showAdmin = user ? isAdminEmail(user.email) : false;
  const supportEmail = getSupportEmail();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#eef2ff,transparent_34%),linear-gradient(135deg,#f8fafc,#eef2f7_45%,#fafafa)] text-slate-950">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 md:grid-cols-[244px_1fr]">
        <aside className="sticky top-6 h-fit rounded-3xl border border-white/70 bg-white/82 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.10)] backdrop-blur">
          <Link href="/dashboard" className="mb-5 block">
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-600">JobPing</span>
            <span className="mt-1 block text-lg font-black tracking-tight">Lead Revenue Console</span>
          </Link>
          <nav className="space-y-1">
            {links.map(([label, href]) => (
              <Link key={href} href={href} className="block rounded-2xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-950 hover:text-white">
                {label}
              </Link>
            ))}
            {showAdmin ? (
              <Link href="/admin" className="mt-3 block rounded-2xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-sm font-bold text-indigo-700 transition hover:bg-indigo-600 hover:text-white">
                Support Console
              </Link>
            ) : null}
          </nav>
          <div className="mt-6 rounded-2xl bg-slate-950 p-4 text-white">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-200">Value proof</div>
            <p className="mt-2 text-sm text-slate-200">Every lead reply, follow-up, and review request is logged for billing-safe accountability.</p>
            <a className="mt-3 block break-all text-xs font-bold text-indigo-200 underline" href={`mailto:${supportEmail}?subject=JobPing support request`}>{supportEmail}</a>
          </div>
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
