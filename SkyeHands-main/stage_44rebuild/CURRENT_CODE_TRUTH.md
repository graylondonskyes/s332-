# CURRENT CODE TRUTH

_Directive section 17 — Honest Documentation_
_As-of: 2026-04-26 | Branch: claude/review-directives-start-implementation-GFQv2_

This document describes what the SkyeHands codebase actually contains, not what it aspires to be.
Readiness labels are code-backed. No label is manually written — it reflects file evidence and smoke results.

---

## Platform Truth Labels

| Platform | Label | Evidence |
|----------|-------|----------|
| **Theia IDE** (`platform/ide-core/`) | SKELETON | Source present, `node_modules` exists, but `resolvedTheiaCli: null`. No launch, build, or workspace proof. |
| **OpenHands Agent** (`platform/agent-core/`) | SKELETON / runtime-shim | `pyproject.toml` present, boundary shim exists. Python package not proven importable. No server launch or task proof. |
| **AE Command Hub** | FUNCTIONAL-PARTIAL | Route files + partial UI exist. No persistence layer wired. No per-brain state records. |
| **SkyeHands Platform Bus** | IMPLEMENTED (new) | `core/platform-bus/skyehands-platform-bus.mjs` implemented with file-backed local queue, signed envelopes, audit ledger, and subscriber registry. Behavioral smoke: `smokeRoundTrip()`. |
| **AE Brain Mesh** | IMPLEMENTED (new) | `netlify/functions/_shared/ae_brain_mesh.js` + `ae_brain_state.js` + `ae_brain_registry.js` implemented. 13 brains registered. Per-brain state, queue, memory, usage, audit. Brain-to-brain messaging with max-hop protection. |
| **AE Command Hub DB** | IMPLEMENTED (new) | `db_schema.sql` (SQLite/Neon schema) + `repositories.js` (tenant, user, session, client, task, audit, workspace). |
| **Printful Commerce Brain** | FUNCTIONAL-PARTIAL | Dry-run previously returned false success. Provider router now requires real service function path. |
| **AI Appointment Setter** | HTML-ONLY | Static HTML pages. No OAuth, no availability API, no booking backend. |
| **Maggies Store** | HTML-ONLY / SKELETON | No merchant backend, no inventory CRUD, no cart/checkout. |
| **Skye Lead Vault** | SKELETON | No IndexedDB persistence, no lead scoring, no activity timeline. |
| **Skye Media Center** | HTML-ONLY | No media asset database, no upload abstraction. |
| **Skye Music Nexus** | FUNCTIONAL-PARTIAL | Express app exists. No artist account model, no release workflow, no purchase ledger. |
| **SkyDexia** | SKELETON | Code generation concept exists. No project ingest/generation/export APIs. |
| **GrayChunks Scanner** | IMPLEMENTED (upgraded) | `scripts/graychunks-readiness-report.mjs` upgraded with: 13 violation rules, platform grading engine, donor lane status, runtime proof flag scanning, CI gate, CODE_READINESS_MATRIX.md + JSON + CLAIMS_TO_SMOKE_MAP.json generation. |

---

## What Is Now Implemented (This Branch)

The following were MISSING before this branch and are now implemented:

### Core Infrastructure
- `core/platform-bus/skyehands-platform-bus.mjs` — event bus with signed envelopes, file-backed local queue, audit ledger, subscriber registry, round-trip smoke
- `platform/contracts/platform-capability.schema.json` — capability declaration contract
- `platform/contracts/file-shipment.schema.json` — cross-platform file shipment contract
- `platform/contracts/productization.schema.json` — app-to-product workflow contract

### AE Brain Mesh
- `netlify/functions/_shared/ae_brain_registry.js` — 13 brains registered with roles, capabilities, provider prefs, permissions
- `netlify/functions/_shared/ae_brain_state.js` — per-brain state, memory, queue, usage ledger, audit trail (local file-backed + Neon adapter interface)
- `netlify/functions/_shared/ae_brain_mesh.js` — inter-brain messaging, max-hop protection, transcript, onboarding scenario
- `netlify/functions/_shared/ae_provider_router.js` — real Anthropic/OpenAI/Gemini dispatch + dry-run via shared function

### Persistence
- `netlify/functions/_shared/db_schema.sql` — Neon/SQLite schema for all entities
- `netlify/functions/_shared/repositories.js` — repository interfaces (Tenants, Users, Sessions, Clients, Tasks, AuditLog, Workspaces)

### Theia / OpenHands Lane Wiring
- `platform/ide-core/scripts/theia-install-proof.mjs` — resolves Theia CLI, writes proof file
- `platform/ide-core/scripts/theia-smoke.mjs` — proves 7 Theia runtime flags, writes `fullTheiaRuntime`
- `platform/agent-core/scripts/openhands-install-proof.mjs` — proves Python import, writes proof file
- `platform/agent-core/scripts/openhands-smoke.mjs` — proves 7 OpenHands runtime flags, writes `fullOpenHandsRuntime`
- `platform/agent-core/runtime/lib/server.mjs` — boundary shim with proof-flag check, blocks claims until smoke proven

### GrayChunks Upgrade
- `scripts/graychunks-readiness-report.mjs` — 13 violation rules, CI gate, multi-platform scan
- `scripts/validate-providers.mjs` — per-provider env var check and blocked-state report

### Provider Contracts
- `PROVIDER_CONTRACTS.json` — env vars, dry-run behavior, production gating for 13 providers

### Proof Discipline Artifacts
- `PROOF_BUNDLE_MANIFEST.schema.json`
- `LEGACY_CHECKMARK_REVALIDATION_REPORT.md`
- `DIRECTIVE_DOWNGRADE_REPORT.md`
- `EXISTING_DONOR_LANE_PROOF.md`

---

## What Remains Open

The following items from the directive are not yet implemented and remain as open targets:

### Step 5: Appointment Setter Backend (directive section 7)
- OAuth flow for Google Calendar and Microsoft 365
- Calendly scheduling link path
- Availability query, booking create, reschedule/cancel
- Reminders and AE handoff

### Step 6: Printful Commerce Full Backend (directive section 8)
- Real Printful service layer (`printful_service.js`)
- Product sync, variant mapping, draft order, webhook verification
- Storefront publishing, order/customer ledger

### Step 7: Maggies Store Backend (directive section 9)
- Merchant auth + profile
- Inventory CRUD, product detail backend
- Cart, checkout, payment abstraction
- Routex dispatch packet generation

### Step 8: SkyDexia File Shipment (directive section 13)
- Project ingest, generation, patching, export APIs
- Bridge emission on completion
- Provenance ledger

### Step 9: Workspace Lifecycle + Browser IDE (directive section 4)
- Workspace create/open/pause/archive/delete/snapshot
- Browser IDE: file tree, editor, terminal, preview, logs, smoke panel
- Agent plan → edit → run → test → repair loop
- Deployment automation (Cloudflare, Netlify, GitHub)

### Step 10: Media, Music, Lead Vault (directive sections 10-12)
- Lead Vault: IndexedDB, backup, scoring, activity timeline
- Media Center: asset database, upload, search, publish
- Music Nexus: artist model, release workflow, purchase ledger, payout

### Step 11: Full smoke suite and docs honesty rewrite
- Behavioral smoke for all implemented platforms
- PROOF_BUNDLE_INDEX.md
- Production-ready language audit across all READMEs
