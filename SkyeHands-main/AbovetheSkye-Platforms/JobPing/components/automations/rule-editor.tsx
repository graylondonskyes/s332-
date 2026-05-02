"use client";

import { Button } from "@/components/shared/button";

type Rule = {
  id: string;
  ruleType: string;
  triggerEvent: string;
  delayMinutes: number;
  isEnabled: boolean;
};

export function RuleEditor({ rules }: { rules: Rule[] }) {
  async function updateRule(id: string, payload: Partial<Rule>) {
    const response = await fetch(`/api/automations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) alert("Failed to update rule.");
    else window.location.reload();
  }

  return (
    <div className="space-y-4">
      {rules.map((rule) => (
        <div key={rule.id} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="font-semibold">{rule.ruleType.replaceAll("_", " ")}</div>
              <div className="text-sm text-zinc-500">Trigger: {rule.triggerEvent}</div>
            </div>
            <label className="text-sm">
              <input type="checkbox" defaultChecked={rule.isEnabled} onChange={(e) => updateRule(rule.id, { isEnabled: e.target.checked })} className="mr-2" />
              Enabled
            </label>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <input
              type="number"
              defaultValue={rule.delayMinutes}
              min={0}
              className="w-36 rounded-lg border px-3 py-2"
              onBlur={(e) => updateRule(rule.id, { delayMinutes: Number(e.target.value) })}
            />
            <span className="text-sm text-zinc-500">Delay in minutes</span>
            <Button type="button" onClick={() => updateRule(rule.id, { isEnabled: !rule.isEnabled })}>Toggle</Button>
          </div>
        </div>
      ))}
    </div>
  );
}
