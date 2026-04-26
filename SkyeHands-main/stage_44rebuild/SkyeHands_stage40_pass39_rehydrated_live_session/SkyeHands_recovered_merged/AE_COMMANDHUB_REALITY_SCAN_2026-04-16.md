# AE / CommandHub / Skye Route / CRM Reality Scan (Code-Based)

Date: 2026-04-16
Scope: `platform/user-platforms/skye-account-executive-commandhub-s0l26-0s`

## 1) What is real (code-backed)

### Branch app code volume (LOC)
- AE-Brain-Command-Site-v8-Additive: 11 files / 15,905 LOC
- AI-Appointment-Setter-Brain-v33: 30 files / 24,383 LOC
- Printful-Commerce-Brain-EDM-pass6: 58 files / 7,484 LOC
- Skye-Lead-Vault-Offline-Phase2-with-Walkthrough: 16 files / 4,109 LOC
- Skye-Media-Center-v1: 6 files / 385 LOC
- Skye-Music-Nexus: 27 files / 6,098 LOC

### CRM/Command features confirmed in AE app source
The following markers were found in AE app code (`assets/app.js`):
- `save-client`
- `client-history-panel`
- `manual-assign-btn`
- `create-client-task`
- `create-client-thread`
- `client-stage-filter`
- `client-priority-filter`
- `bulk-auto-assign`
- `bulk-manual-assign`

Result: 9/9 selected CRM/command markers present.

## 2) What is stubbed / shallow / questionable

### Netlify runtime surfaces under AE pack
- Total JS files scanned in `netlify/functions`: 33
- Stub-like/minimal files: 28
- More substantial files: 5

Stub examples include one-liner handlers or tiny placeholders such as:
- `netlify/functions/ae-access-users.js`
- `netlify/functions/ae-assignments.js`
- `netlify/functions/ae-audit-events.js`
- `netlify/functions/ae-brain-chat.js`
- `netlify/functions/_shared/neon.js`

### CommandHub manifest target integrity
From `skyehands.platform.json` package scripts:
- Total scripts listed: 35
- Scripts with `commandTargetExists: false`: 30

Representative missing targets:
- `integration/commandhub-local-service.js`
- `integration/commandhub-stage1-smoke.js`
- `integration/commandhub-stage2-smoke.js`
- `integration/commandhub-stage3-smoke.js`
- `integration/commandhub-stage4-truth-smoke.js`

## 3) Reality call (bullshit vs not-bullshit)

### Not-bullshit (real depth exists)
- AE app and appointment lane contain significant non-trivial code volume.
- CRM/control-plane features are concretely present in source.
- Printful, music, and lead-vault branch apps are present with executable code.

### Bullshit / inflated claims risk
- A large portion of AE root Netlify runtime is currently placeholder-level.
- Manifest advertises many script targets that are not present.
- “PASS” smoke can pass while still relying on scaffolds unless runtime depth checks are tightened.

## 4) Immediate required hardening updates
1. Replace placeholder Netlify handlers with production implementations and integration tests.
2. Reconcile `skyehands.platform.json` command targets so missing integration scripts are either added or removed.
3. Split smoke into:
   - Structural smoke (surface exists)
   - Runtime smoke (real external/provider/data-path behavior)
4. Require provider-backed script proofs for every checked directive item tied to runtime behavior.
