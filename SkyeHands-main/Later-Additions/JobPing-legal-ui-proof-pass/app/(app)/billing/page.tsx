import { CheckoutButton } from "@/components/billing/checkout-button";
import { AppShell } from "@/components/shared/app-shell";
import { Card } from "@/components/shared/card";
import { requireAccountUser } from "@/lib/auth";
import { getAccountUsage } from "@/lib/usage";
import { getPlan, JOBPING_PLANS } from "@/lib/plans";

export default async function BillingPage() {
  const user = await requireAccountUser();
  const subscription = user.account?.subscription;
  const usage = await getAccountUsage(user.accountId!);
  const plan = getPlan(subscription?.planName);
  const smsPct = Math.min(100, Math.round((usage.smsUsed / Math.max(1, usage.includedSmsSegments)) * 100));
  const aiPct = Math.min(100, Math.round((usage.aiUsed / Math.max(1, usage.includedAiActions)) * 100));

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Billing & usage guardrails</h1>
          <p className="mt-1 text-zinc-600">Charge monthly without letting SMS volume quietly eat the margin.</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {Object.entries(JOBPING_PLANS).map(([key, item]) => (
            <Card key={key} className={item.name === plan.name ? "border-emerald-400" : ""}>
              <div className="text-sm font-semibold text-emerald-700">{item.name}</div>
              <div className="mt-2 text-3xl font-black">${item.monthlyPrice}<span className="text-sm font-semibold text-zinc-500">/mo</span></div>
              <p className="mt-2 text-sm text-zinc-600">${item.setupFee} setup • {item.includedSmsSegments.toLocaleString()} SMS segments • {item.includedAiActions} AI assists</p>
              <p className="mt-3 text-sm text-zinc-700">{item.description}</p>
            </Card>
          ))}
        </div>

        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm text-zinc-500">Current plan</div>
              <div className="mt-2 text-2xl font-bold">{subscription?.planName || "starter"}</div>
              <div className="mt-2 text-sm text-zinc-500">Status: <span className="font-semibold text-zinc-800">{subscription?.status || "inactive"}</span></div>
            </div>
            <div><CheckoutButton hasCustomer={Boolean(subscription?.providerCustomerId)} /></div>
          </div>
          <p className="mt-4 text-sm text-zinc-600">Stripe checkout and customer-portal management activate when STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID, and Stripe portal settings are configured.</p>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="flex items-center justify-between"><h2 className="text-xl font-bold">SMS fair-use meter</h2><span className="text-sm font-semibold">{usage.smsUsed} / {usage.includedSmsSegments}</span></div>
            <div className="mt-4 h-3 rounded-full bg-zinc-100"><div className="h-3 rounded-full bg-emerald-500" style={{ width: `${smsPct}%` }} /></div>
            <p className="mt-3 text-sm text-zinc-600">Overages are {usage.smsOverageEnabled ? "enabled" : "off"}. Hard stop is {usage.hardStopAtLimit ? "on" : "off"}. Overage rate: ${Number(usage.smsOverageCents / 100).toFixed(2)} per segment.</p>
          </Card>

          <Card>
            <div className="flex items-center justify-between"><h2 className="text-xl font-bold">AI assist meter</h2><span className="text-sm font-semibold">{usage.aiUsed} / {usage.includedAiActions}</span></div>
            <div className="mt-4 h-3 rounded-full bg-zinc-100"><div className="h-3 rounded-full bg-sky-500" style={{ width: `${aiPct}%` }} /></div>
            <p className="mt-3 text-sm text-zinc-600">AI is positioned as assistive copy support only: rewrite templates, summarize leads, and suggest replies. It does not claim guaranteed bookings or autonomous sales.</p>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
