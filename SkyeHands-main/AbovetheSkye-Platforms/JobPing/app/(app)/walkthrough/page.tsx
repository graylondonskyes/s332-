import { AppShell } from "@/components/shared/app-shell";
import { WalkthroughClient } from "@/components/walkthrough/walkthrough-client";
import { getSupportEmail } from "@/lib/support";

export default function WalkthroughPage() {
  return (
    <AppShell>
      <WalkthroughClient supportEmail={getSupportEmail()} />
    </AppShell>
  );
}
