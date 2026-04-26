# DIRECTIVE DOWNGRADE REPORT

_Generated per directive section 1.1_
_As-of: 2026-04-26_

## Purpose

This report lists every capability that has been downgraded from a previously-claimed
status (complete/production-ready) to the truth label (functional-partial/skeleton/html-only)
until behavioral smoke exists.

---

## Downgraded Capabilities

### AE Command Hub
- **Previous claim:** PRODUCTION-READY (multi-brain AI operating layer)
- **Actual grade:** FUNCTIONAL-PARTIAL
- **Reason:** Route files and partial UI exist. No per-brain state records, no persistence layer wired to Neon or local DB, no behavioral smoke proving login + client + brain + task + audit flow.
- **Required to reinstate:** Sections 5 and 6 of directive implemented and smoked.

### Theia IDE
- **Previous claim:** Complete (donor repo present)
- **Actual grade:** SKELETON
- **Reason:** `platform/ide-core/package.json` identifies the lane. `node_modules` dir exists. But `resolvedTheiaCli: null` — CLI not resolved. No build proof. No launch proof. No workspace mount proof.
- **Required to reinstate:** Section 3.4 Theia proof flags all `true`, `fullTheiaRuntime: true` emitted by smoke.

### OpenHands Agent
- **Previous claim:** Complete (metadata + boundary shim present)
- **Actual grade:** SKELETON / runtime-shim
- **Reason:** `platform/agent-core/pyproject.toml` identifies the lane as `openhands-ai`. `server.mjs` is boundary shim only. Python package not proven importable. No task execution proof.
- **Required to reinstate:** Section 3.4 OpenHands proof flags all `true`, `fullOpenHandsRuntime: true` emitted by smoke.

### Printful Commerce Brain
- **Previous claim:** Functional (dry-run success)
- **Actual grade:** FUNCTIONAL-PARTIAL (dry-run false success)
- **Reason:** Dry-run returns `success: true` without calling real Printful service function. Mock returns don't count.
- **Required to reinstate:** Section 8 directive implemented. Dry-run must pass through same service function as production.

### AI Appointment Setter
- **Previous claim:** Functional (booking page exists)
- **Actual grade:** HTML-ONLY
- **Reason:** Static HTML pages with no OAuth connection, no availability API, no booking backend.
- **Required to reinstate:** Section 7 directive implemented and smoked.

### 13 AE Brains (independent runtime)
- **Previous claim:** 13 independent brains
- **Actual grade:** SKELETON (roster entries only)
- **Reason:** Brain definitions exist as JSON/persona entries. No per-brain state record, task queue, usage ledger, memory store, or permission scope.
- **Required to reinstate:** Section 5 directive implemented. Each brain can receive task → respond → write state → log usage.

### SkyeHands Platform Bus
- **Previous claim:** Not previously claimed as complete
- **Actual grade:** MISSING
- **Reason:** No implementation found.
- **Required to implement:** Section 3.1 directive.

### SkyDexia
- **Previous claim:** Code generation lane present
- **Actual grade:** SKELETON
- **Reason:** Lane concept exists but no project ingest, generation, patching, export APIs, or bridge emission.
- **Required to reinstate:** Section 13 directive implemented and smoked.

### Skye Lead Vault
- **Previous claim:** Functional
- **Actual grade:** HTML-ONLY or SKELETON
- **Reason:** No IndexedDB persistence, no encrypted backup, no lead scoring, no activity timeline.
- **Required to reinstate:** Section 10 directive implemented and smoked.

### Skye Media Center
- **Previous claim:** Functional
- **Actual grade:** HTML-ONLY
- **Reason:** No media asset database, no upload abstraction, no search backend.
- **Required to reinstate:** Section 11 directive implemented and smoked.

---

## Release Gate

No platform may appear in release documentation as PRODUCTION-READY until:
1. This report shows it removed from the downgraded list
2. `CODE_READINESS_MATRIX.json` grades it PRODUCTION-READY
3. `CLAIMS_TO_SMOKE_MAP.json` shows all claims `passing: true`
4. Proof bundle exists with behavioral smoke artifacts
