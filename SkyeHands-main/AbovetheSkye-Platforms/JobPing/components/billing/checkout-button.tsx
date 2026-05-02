"use client";

import { useState } from "react";
import { Button } from "@/components/shared/button";

export function CheckoutButton({ hasCustomer = false }: { hasCustomer?: boolean }) {
  const [loading, setLoading] = useState<"checkout" | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function openBilling(action: "checkout" | "portal") {
    setLoading(action);
    setError(null);
    const response = await fetch(action === "portal" ? "/api/billing/portal" : "/api/billing/checkout", { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setLoading(null);
    if (!response.ok) {
      setError(data.error || `Unable to open ${action}.`);
      return;
    }
    const url = action === "portal" ? data.portalUrl : data.checkoutUrl;
    if (url) window.location.href = url;
    else setError(`${action === "portal" ? "Portal" : "Checkout"} URL was not returned by Stripe.`);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => openBilling("checkout")} disabled={Boolean(loading)}>{loading === "checkout" ? "Opening checkout..." : "Start subscription"}</Button>
        {hasCustomer ? <Button onClick={() => openBilling("portal")} disabled={Boolean(loading)}>{loading === "portal" ? "Opening portal..." : "Manage billing"}</Button> : null}
      </div>
      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
    </div>
  );
}
