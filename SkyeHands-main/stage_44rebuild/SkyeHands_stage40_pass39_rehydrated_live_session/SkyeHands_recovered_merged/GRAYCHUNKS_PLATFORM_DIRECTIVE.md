# GrayChunks Platform Directive (Commercial + Internal Runtime)

## 1) Product Definition
GrayChunks is a deployable quality platform that detects merge-generated garbage and structural code debt (duplicate imports, duplicate object/config keys, malformed JSX trees, and repeated key drift), then orchestrates triage, remediation, and admin alerting.

## 2) Must-Have Runtime Capabilities
1. Scanner runtime: executable scan over first-party code with machine+human artifacts.
2. Deterministic autofix runtime: only safe transformations (currently duplicate import dedupe).
3. Priority queue runtime: severity scoring, owner routing, suggested fixes.
4. Alert runtime: Resend-backed admin dispatch with dry-run and delivery artifact.
5. Control-plane runtime: AE and external callers can trigger scan/queue/alert/cycle via authenticated API.
6. Autonomous cycle runtime: scan -> autofix -> rescan -> queue -> alert.

## 3) External Team Packaging Requirements
- Must run as script-only drop-in (`npm run graychunks:*`) for repo-local use.
- Must run as API service (`graychunks:server`) for external integration.
- Must expose authentication via token and environment vars.
- Must keep outputs in stable artifact paths for CI and downstream systems.

## 4) Environment Contract
- `RESEND_API_KEY`: live email delivery key.
- `GRAYCHUNKS_ALERT_FROM`: sender address.
- `GRAYCHUNKS_ALERT_RECIPIENTS`: comma-separated recipients.
- `GRAYCHUNKS_ALERT_DRY_RUN`: set `1` for non-live dispatch.
- `GRAYCHUNKS_API_TOKEN`: token for server routes.
- `GRAYCHUNKS_CONTROL_TOKEN`: token for AE control function.

## 5) Required Proof Bar
- Smoke cannot pass on route existence.
- Smoke must seed defects and verify detection.
- Smoke must prove remediation delta where deterministic fix exists.
- Smoke must prove alert-dispatch artifact generation.
- Smoke must prove AE/control-plane path can execute actions.

## 6) Current Implementation Scope
- Scanner, autofix, queue, alert, runtime cycle scripts: implemented.
- AE control endpoint for GrayChunks: implemented.
- External HTTP server mode: implemented.
- UI-level GrayChunks operator panel and button-position visual verification: pending.
