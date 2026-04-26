import { AppShell } from "@/components/shared/app-shell";
import { Card } from "@/components/shared/card";
import { requireAccountUser } from "@/lib/auth";
import { getAccountUsage } from "@/lib/usage";

export default async function AiAssistPage() {
  const user = await requireAccountUser();
  const usage = await getAccountUsage(user.accountId!);
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-sky-700">Assistive AI, not fake autonomy</p>
          <h1 className="mt-2 text-3xl font-black">AI assist center</h1>
          <p className="mt-2 max-w-3xl text-zinc-600">Use AI only where it makes the product stronger: rewriting templates, summarizing lead notes, and suggesting response copy. The app does not promise guaranteed bookings or autonomous sales agents.</p>
        </div>
        <Card>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Monthly AI usage</h2>
              <p className="mt-1 text-sm text-zinc-600">{usage.aiUsed} / {usage.includedAiActions} assists used this period.</p>
            </div>
            <div className="rounded-2xl bg-sky-50 px-4 py-3 text-sm font-bold text-sky-800">OPENAI_API_KEY optional</div>
          </div>
        </Card>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["Template rewrite", "Improve a welcome, missed-call, follow-up, quote, or review-request template without changing the business promise."],
            ["Lead summary", "Condense notes and activity into a quick owner-readable summary before calling back."],
            ["Reply suggestion", "Draft a professional response using the lead’s service type and timeline context."],
          ].map(([title, body]) => (
            <Card key={title}>
              <h3 className="text-lg font-black">{title}</h3>
              <p className="mt-2 text-sm text-zinc-600">{body}</p>
            </Card>
          ))}
        </div>
        <Card>
          <h2 className="text-xl font-bold">API contract</h2>
          <p className="mt-2 text-sm text-zinc-600">POST <code>/api/ai/assist</code> with <code>actionType</code> as <code>rewrite_template</code>, <code>lead_summary</code>, or <code>reply_suggestion</code>. It logs every action and counts usage before returning copy.</p>
        </Card>
      </div>
    </AppShell>
  );
}
