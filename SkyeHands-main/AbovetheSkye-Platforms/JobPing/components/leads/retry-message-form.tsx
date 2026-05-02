"use client";

import { useState } from "react";
import { Button } from "@/components/shared/button";

export function RetryMessageForm({ eventId }: { eventId: string }) {
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  async function retry() {
    setState("saving");
    const response = await fetch(`/api/message-events/${eventId}/retry`, { method: "POST" });
    if (response.ok) {
      setState("done");
      window.location.reload();
    } else {
      setState("error");
    }
  }
  return <Button type="button" onClick={retry} disabled={state === "saving"}>{state === "saving" ? "Queuing…" : state === "done" ? "Queued" : "Retry send"}</Button>;
}
