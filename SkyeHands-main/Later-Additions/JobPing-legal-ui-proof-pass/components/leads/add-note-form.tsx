"use client";

import { useState } from "react";
import { Button } from "@/components/shared/button";

export function AddNoteForm({ leadId }: { leadId: string }) {
  const [body, setBody] = useState("");

  async function submit() {
    const response = await fetch(`/api/leads/${leadId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (response.ok) {
      setBody("");
      window.location.reload();
    } else {
      alert("Failed to add note.");
    }
  }

  return (
    <div className="space-y-3">
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} className="w-full rounded-lg border px-3 py-2" placeholder="Add note" />
      <Button type="button" onClick={submit} disabled={!body.trim()}>Save note</Button>
    </div>
  );
}
