# Legal and UI Proof Pass

This pass reduces two remaining overclaim risks.

## Compliance copy and consent posture

Added stronger Terms, Privacy Policy, and SMS Terms pages. The SMS Terms now state permitted message types, consent requirement, STOP/START behavior, fair-use limits, carrier limitation language, customer responsibility, and that the policy is not a substitute for legal counsel.

Added signup legal links and onboarding messaging-policy acknowledgement so customer setup includes visible messaging responsibility before operation.

What is still live/legal external: attorney review and real carrier behavior proof after Twilio is configured.

## Customer-ready UI proof posture

Added `/ui-readiness` as an authenticated readiness contract screen that lists screen families and interactive controls that must be browser-smoked.

Added `scripts/ui-contract-proof.mjs` to statically verify the key app pages, public pages, legal pages, and primary component/action files exist. This does not replace Playwright/browser smoke, but it prevents claiming the UI is ready without the required surfaces present.

The honest status after this pass: legal/customer-facing copy and UI-readiness contract are code-added. Live carrier compliance proof and browser smoke still require deployment/runtime.
