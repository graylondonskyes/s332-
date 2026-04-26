"use client";

import { useState } from "react";
import { Button } from "@/components/shared/button";

const packs = [
  { id: "plumbing", name: "Plumbing", note: "Emergency + quote follow-up" },
  { id: "hvac", name: "HVAC", note: "Comfort + AC/heating calls" },
  { id: "cleaning", name: "Cleaning", note: "Booking + recurring service" },
  { id: "detailing", name: "Mobile Detailing", note: "Vehicle detail + mobile appointments" },
];

type Template = {
  id: string;
  name: string;
  body: string;
  templateType: string;
  isEnabled: boolean;
};

export function TemplateEditor({ templates }: { templates: Template[] }) {
  const [items, setItems] = useState(templates);
  const [status, setStatus] = useState<string | null>(null);

  async function save(template: Template) {
    const response = await fetch(`/api/templates/${template.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: template.body, name: template.name, isEnabled: template.isEnabled }),
    });
    setStatus(response.ok ? "Template saved." : "Failed to save template.");
  }

  async function applyPack(packId: string) {
    const response = await fetch("/api/template-packs/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packId }),
    });
    if (!response.ok) {
      setStatus("Template pack failed to apply.");
      return;
    }
    setStatus("Template pack applied. Refreshing templates...");
    window.location.reload();
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-black">Niche template packs</h2>
            <p className="mt-1 text-sm text-slate-500">Apply market-facing copy across every workflow in one click.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {packs.map((pack) => (
              <button key={pack.id} type="button" onClick={() => applyPack(pack.id)} className="rounded-2xl border border-slate-200 px-4 py-3 text-left hover:border-indigo-400 hover:bg-indigo-50">
                <span className="block text-sm font-black">{pack.name}</span>
                <span className="text-xs text-slate-500">{pack.note}</span>
              </button>
            ))}
          </div>
        </div>
        {status ? <p className="mt-4 rounded-2xl bg-slate-100 p-3 text-sm font-semibold text-slate-700">{status}</p> : null}
      </div>

      {items.map((template, index) => (
        <div key={template.id} className="rounded-[2rem] border border-white/80 bg-white/92 p-5 shadow-xl">
          <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <input
              value={template.name}
              onChange={(e) => {
                const next = [...items];
                next[index] = { ...template, name: e.target.value };
                setItems(next);
              }}
              className="jp-input w-full font-black"
            />
            <label className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-bold">
              <input
                type="checkbox"
                checked={template.isEnabled}
                onChange={(e) => {
                  const next = [...items];
                  next[index] = { ...template, isEnabled: e.target.checked };
                  setItems(next);
                }}
              />
              Enabled
            </label>
          </div>
          <div className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-indigo-600">{template.templateType}</div>
          <textarea
            value={template.body}
            onChange={(e) => {
              const next = [...items];
              next[index] = { ...template, body: e.target.value };
              setItems(next);
            }}
            rows={5}
            className="jp-input w-full"
          />
          <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs font-semibold text-slate-500">
            Variables: {'{{first_name}}'} {'{{business_name}}'} {'{{service_type}}'} {'{{review_url}}'} {'{{business_phone}}'}
          </div>
          <div className="mt-3 flex justify-end">
            <Button type="button" onClick={() => save(items[index])}>Save template</Button>
          </div>
        </div>
      ))}
    </div>
  );
}
