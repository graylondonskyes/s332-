"use client";

const statuses = ["new", "contacted", "quoted", "booked", "completed", "lost"];

export function LeadStatusForm({ leadId, currentStatus }: { leadId: string; currentStatus: string }) {
  async function onChange(value: string) {
    const response = await fetch(`/api/leads/${leadId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: value }),
    });
    if (response.ok) {
      window.location.reload();
    } else {
      alert("Failed to update status.");
    }
  }

  return (
    <select defaultValue={currentStatus} onChange={(e) => onChange(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
      {statuses.map((status) => (
        <option key={status} value={status}>
          {status}
        </option>
      ))}
    </select>
  );
}
