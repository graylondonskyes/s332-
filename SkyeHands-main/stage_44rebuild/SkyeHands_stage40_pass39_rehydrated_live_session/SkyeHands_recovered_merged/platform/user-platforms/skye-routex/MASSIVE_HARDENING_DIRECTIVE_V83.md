# MASSIVE HARDENING DIRECTIVE V83 — Bullshit Removal Pass

Directive: remove proof inflation and code paths that allowed local success to be confused with production completion.

Implemented in this package:

1. Clean V83 runtime package with old proof/state/directive residue pruned.
2. Strict Neon-primary mode now fails before a local JSON fallback write when Neon is missing.
3. Neon schema now includes operational tables for active sessions, operational events, payment ledger rows, and webhook replay rows, not snapshots only.
4. PayPal webhook verification now has a real OAuth + `/v1/notifications/verify-webhook-signature` code path when provider network and credentials are explicitly enabled.
5. Stripe and PayPal webhook handlers now persist through the shared persistence wrapper.
6. Production readiness now rejects plaintext-only/bootstrap-open credential posture.
7. App Fabric static audit is explicitly labeled as static-file analysis, not browser click automation.
8. Deployment receipts are explicitly local-readiness receipts, not live deployment proof.
9. 0s mount is explicitly a shell manifest mount, not process/sandbox runtime proof.

Still not claimed: live money movement, deployed DNS/SSL, live provider callbacks, real browser click automation, live Neon-primary proof, full warehouse/driver/navigation operations depth.
