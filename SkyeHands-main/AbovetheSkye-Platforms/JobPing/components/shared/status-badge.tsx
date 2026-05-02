const tones: Record<string, string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  trial: "border-indigo-200 bg-indigo-50 text-indigo-700",
  past_due: "border-amber-200 bg-amber-50 text-amber-700",
  canceled: "border-rose-200 bg-rose-50 text-rose-700",
  failed: "border-rose-200 bg-rose-50 text-rose-700",
  skipped: "border-amber-200 bg-amber-50 text-amber-700",
  sent: "border-emerald-200 bg-emerald-50 text-emerald-700",
  delivered: "border-emerald-200 bg-emerald-50 text-emerald-700",
  new: "border-sky-200 bg-sky-50 text-sky-700",
  booked: "border-emerald-200 bg-emerald-50 text-emerald-700",
  completed: "border-violet-200 bg-violet-50 text-violet-700",
  lost: "border-slate-200 bg-slate-100 text-slate-600",
};

export function StatusBadge({ label }: { label: string }) {
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${tones[label] || "border-slate-200 bg-white text-slate-600"}`}>{label}</span>;
}
