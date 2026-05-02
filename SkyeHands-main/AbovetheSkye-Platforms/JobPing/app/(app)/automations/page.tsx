import { AppShell } from "@/components/shared/app-shell";
import { requireAccountUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { RuleEditor } from "@/components/automations/rule-editor";

export default async function AutomationsPage() {
  const user = await requireAccountUser();
  const rules = await prisma.automationRule.findMany({
    where: { accountId: user.accountId! },
    orderBy: [{ triggerEvent: "asc" }, { sequenceOrder: "asc" }],
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Automations</h1>
          <p className="mt-1 text-zinc-600">Control when follow-ups and review requests fire.</p>
        </div>
        <RuleEditor rules={rules.map((rule) => ({
          id: rule.id,
          ruleType: rule.ruleType,
          triggerEvent: rule.triggerEvent,
          delayMinutes: rule.delayMinutes,
          isEnabled: rule.isEnabled,
        }))} />
      </div>
    </AppShell>
  );
}
