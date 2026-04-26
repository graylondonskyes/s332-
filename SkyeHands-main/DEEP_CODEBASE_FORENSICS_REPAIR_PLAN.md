# SKYEHANDS CODEBASE: DEEP FORENSICS REPORT (CORRECTED)

**Date:** April 25, 2026 (updated from April 24 — previous version had significant errors)
**Status:** VERIFIED — Based on live deep scan of all files
**Severity:** PARTIAL — Most components present; key missing piece is SkyeRoutex integration

---

## EXECUTIVE SUMMARY

The `stage_44rebuild` codebase is **more complete than previously reported**. The original repair docs were written with incorrect file counts, misidentified "missing" directories that are actually present, and missed the canonical app root structure entirely.

**The real situation:**
- The canonical app lives at `stage_44rebuild/SkyeHands_stage40_pass39_rehydrated_live_session/SkyeHands_recovered_merged/` — this is declared explicitly in `skyehands.repo.config.json`
- Most "missing" components (apps, branding, config, platform/user-platforms, scripts) ARE present inside the canonical app root
- **The only genuinely missing platform is SkyeRoutex** (486 files in Dynasty-Versions)
- GrayChunks is a fully-built platform with 8 dedicated scripts + smoke tests

### Corrected Stats:

| Metric | stage_44rebuild (Actual) | Dynasty-Versions (Actual) | Previous (Wrong) |
|--------|--------------------------|---------------------------|------------------|
| Total Files | **31,430** | **77,036** | 40,530 / 113,430 |
| Root scripts | 4 bridge scripts | ~70 smoke scripts | 4 / 70 |
| CanonicalApp Scripts | **223 scripts** | N/A | Not mentioned |
| Platform/user-platforms | **5 entries** | 1 entry | "15,000+ missing" |
| SkyeRoutex | ❌ Missing | ✅ 486 files | Correctly flagged |

---

## CANONICAL APP ROOT — THE KEY STRUCTURE

`skyehands.repo.config.json` (at `stage_44rebuild/` root) declares:

```json
{
  "canonicalAppRoot": "SkyeHands_stage40_pass39_rehydrated_live_session/SkyeHands_recovered_merged"
}
```

**This nested layout is BY DESIGN.** The 4 scripts at `stage_44rebuild/scripts/` are bridge/dispatch utilities that route commands into the canonical root. All real application code lives inside `SkyeHands_stage40_pass39_rehydrated_live_session/SkyeHands_recovered_merged/`.

---

## WHAT'S ACTUALLY IN stage_44rebuild

### Root Level (`stage_44rebuild/`)
```
stage_44rebuild/
├── .skyequanta/workspace-runtime/         # Minimal runtime state
├── SkyeHands_stage40_pass39_rehydrated_live_session/
│   └── SkyeHands_recovered_merged/        # ← CANONICAL APP ROOT
├── _skyehands_stage41_additive_manifest/  # Pack metadata (9,103 files applied)
├── dist/production-release/               # Production dist mirror
├── docs/hardening/                        # Hardening docs
├── platform/agent-core/config.toml        # Agent core config
├── platform/ide-core/                     # Full Theia IDE (packages + node_modules)
├── public-websites/skyehands/skyequantacore-current-truth/
├── scripts/                               # 4 bridge/utility scripts
│   ├── _repo-utils.mjs
│   ├── repo-paths.mjs
│   ├── repo-root.mjs
│   └── run-app-script.mjs
├── package.json                           # Repo-root npm scripts
└── skyehands.repo.config.json             # Canonical root declaration
```

### Canonical App Root (`...recovered_merged/`)
```
recovered_merged/
├── .devcontainer/                         # Dev container config
├── .github/workflows/                     # CI/CD workflows
├── .skyequanta/                           # 19 runtime subsystems:
│   ├── autonomous-maintenance/
│   ├── autonomy-gradient/
│   ├── cache/
│   ├── compliance-native-modes/
│   ├── deal-ownership-generation/
│   ├── deep-scan-mode/
│   ├── devglow/
│   ├── environment-mirror/
│   ├── ide-config/
│   ├── kaixu-council/
│   ├── memory-fabric/
│   ├── platform-launchpad/
│   ├── remote-executor/
│   ├── reports/
│   ├── runtime-bus/
│   ├── runtime-deps/
│   ├── runtime-recovery/
│   ├── skye-foundry/
│   ├── skye-reader-bridge/
│   └── workspace-runtime/
├── apps/
│   ├── skye-reader-hardened/              # Enterprise doc reader
│   └── skyequanta-shell/                  # CLI interface
├── branding/                              # Brand assets
├── config/
│   ├── agent/                             # Agent configuration
│   └── env-templates/                     # Env var templates
├── dist/
│   ├── production-release/
│   ├── section39/ ... section61/          # Build artifacts sections 39-61
│   └── ship-candidate/
├── docs/
│   ├── hardening/
│   ├── proof/
│   └── templates/
├── platform/
│   ├── agent-core/                        # Agent platform config
│   ├── ide-core/                          # Full Theia-based IDE
│   ├── user-platforms/
│   │   ├── ae-autonomous-store-system-maggies/  # Autonomous store
│   │   ├── skye-account-executive-commandhub-s0l26-0s/  # AE Command Hub
│   │   ├── skyehands-codex-competitor/
│   │   ├── skyehands-codex-control-plane/
│   │   └── skyehands-codex-real-platform/       # Contains .mjs modules
│   │       ├── skyehands-billing-webhooks.mjs
│   │       ├── skyehands-browser-ide.mjs
│   │       ├── skyehands-codex-real-platform.mjs
│   │       ├── skyehands-deploy-automation.mjs
│   │       ├── skyehands-isolation-controller.mjs
│   │       ├── skyehands-oauth-gateway.mjs
│   │       ├── skyehands-platform-core.mjs
│   │       ├── skyehands-platform-db.mjs
│   │       ├── skyehands-provider-router.mjs
│   │       ├── skyehands-sandbox-runner.mjs
│   │       └── migrations/
│   └── wiring/
├── public/
├── scripts/                               # 223 scripts total
│   ├── graychunks-core.mjs                # GrayChunks platform
│   ├── graychunks-platform-server.mjs
│   ├── graychunks-autofix.mjs
│   ├── graychunks-runtime-cycle.mjs
│   ├── graychunks-alert-resend.mjs
│   ├── graychunks-priority-queue.mjs
│   ├── graychunks-progress-dashboard.mjs
│   ├── graychunks-scan.mjs
│   ├── smoke-p001 ... smoke-p088+         # Full smoke test suite
│   ├── directive-completion.mjs
│   ├── directive-runtime-audit.mjs
│   ├── bootstrap-devcontainer.sh
│   └── ... (223 total)
├── skydexia/                              # Skydexia platform
│   ├── alerts/                            # GrayChunks + other alerts
│   ├── donors/
│   ├── extracted-templates/
│   ├── generated-projects/
│   ├── integration/
│   ├── knowledge-base/
│   ├── knowledge-updates/
│   ├── policies/
│   ├── proofs/
│   └── provenance/
├── graychunks.config.json
├── Makefile
└── README.md
```

---

## GRAYCHUNKS PLATFORM — CORRECTLY IDENTIFIED

GrayChunks is NOT just a config entry in `platform/agent-core/`. It is a **full production platform** with:

| Component | Location |
|-----------|----------|
| `graychunks-core.mjs` | Core engine |
| `graychunks-platform-server.mjs` | Server runtime |
| `graychunks-autofix.mjs` | Auto-fix module |
| `graychunks-runtime-cycle.mjs` | Cycle manager |
| `graychunks-alert-resend.mjs` | Alert dispatch |
| `graychunks-priority-queue.mjs` | Priority queue |
| `graychunks-progress-dashboard.mjs` | Dashboard |
| `graychunks-scan.mjs` | Scan engine |
| `smoke-p085-graychunks-platform.mjs` | Smoke test |
| `smoke-p086-graychunks-ae-integration.mjs` | AE integration test |
| `smoke-p087-graychunks-platform-server.mjs` | Server smoke test |
| `smoke-p088-graychunks-cycle-autofix.mjs` | Cycle autofix test |
| `graychunks.config.json` | Configuration |
| `ae-graychunks-control.js` | AE Command Hub Netlify function |
| `skydexia/alerts/graychunks-*.json` | State & alert tracking |

**Status: COMPLETE — Must be preserved during any merge**

---

## AUTONOMOUS AGENT LANE — PRESENT

The autonomous agent lane IS present in stage_44rebuild. Location:

```
recovered_merged/.skyequanta/autonomous-maintenance/
recovered_merged/.skyequanta/autonomy-gradient/
```

This was flagged as "missing" in the old docs but that was incorrect.

---

## WHAT IS ACTUALLY MISSING

### 1. SkyeRoutex Platform (486 files) — CRITICAL

Location in Dynasty-Versions:
```
Dynasty-Versions/SkyeRoutexFlow_v78_unpacked/
  SkyeRoutexFlow_v69_PLATFORM_HOUSE_CIRCLE_NEON_ENTERPRISE_BACKUP_LANE/
```

**Not present anywhere in stage_44rebuild.** This is the only major missing platform.

Contents:
- `AE-FLOW/AE-Flow/` — PWA app (index.html, sw.js, manifest, 0s-auth-sdk)
- `SkyeRoutex/` — Core routing platform:
  - `WHITE_GLOVE_V64-V78/` — Latest white-glove service docs (V39-V63 older)
  - `netlify/functions/` — 33 phc-* Netlify functions
  - `app-fabric/adapters/` — App fabric layer
  - `apps/audit-ready-console/`, `apps/smoke-dropin-v77/`
  - `investor/` — Enterprise valuation docs
  - `operator/` — Walkthrough docs
  - `assets/`, `icons/`, `neon/`
- `AuditReadyConsole-main/` — Audit console application
- `NEW-SHIT2/` — New features folder
- `skyesol-whiteglove-bookings/` — Bookings service
- `skyesol-whiteglove-dispatch/` — Dispatch service
- `skyesol-whiteglove-memberships/` — Memberships service
- `skyesol-whiteglove-payments/` — Payments service
- `skyesol-whiteglove-runtime/` — Shared runtime
- `skyesol-whiteglove-sync/` — Sync service
- `WHITE_GLOVE_V39-V63/` — Legacy white-glove versions
- `extra-shit/` — Integration audit docs

**Previous docs claimed V39-V64 only — actual is V39-V78.**
**Previous docs listed ae-*.js Netlify functions — actual are phc-*.js functions (33 of them).**

### 2. Root-Level Runtime Scripts

From Dynasty-Versions root (not present in stage_44rebuild):
- `skyequanta.mjs` — Main orchestration entry point
- `Makefile` — Root build targets (recovered_merged has its own Makefile)
- `START_HERE.sh` — Bootstrap script

### 3. Workspace Runtime Templates

```
Dynasty-Versions/workspace/
├── prebuilds/     # Prebuild manifests for local-default, remote-default, preview-stage8
├── secrets/       # Workspace secret templates
└── volumes/       # Volume configs for local-default, remote-default, etc.
```

### 4. src/runtime.js

Dynasty-Versions/src/runtime.js — single core source file not in stage_44rebuild.

### 5. Root-Level .skyequanta State Files

Dynasty-Versions has these at its root `.skyequanta/` that don't exist in stage_44rebuild:
- `fleet-state.json`
- `governance-policy.json`, `governance-cost-ledger.json`, `governance-secrets.json`
- `governance-release-decisions.json`, `governance-tenant-policies.json`
- `collaboration-state.json`
- `ops-state.json`
- `workspace-scheduler-policy.json`, `workspace-scheduler-state.json`
- `snapshot-retention.json`
- `sessions.json`, `workspaces.json`
- `scm-state.json`, `prebuild-state.json`

---

## DYNASTY-VERSIONS STRUCTURE (Reference)

```
Dynasty-Versions/                          # 77,036 total files
├── .skyequanta/                           # Full governance + state files
├── SkyeHands_3_1_9_unpacked/work/        # Earliest reference build
├── SkyeHandsunf/                          # Unfixed reference variant
├── SkyeHands_stage40_pass41_unpacked/     # Stage 40/41 reference
├── SkyeRoutexFlow_v78_unpacked/           # ← KEY MISSING PIECE (486 files)
├── apps/                                  # skye-reader-hardened + skyequanta-shell
│                                          # (includes node_modules — bulk of file count)
├── branding/identity.json
├── config/agent/, env-templates/
├── dist/section39 ... section61/
├── docs/                                  # 60+ docs and directives
├── platform/
│   ├── agent-core/                        # Agent platform
│   ├── ide-core/                          # Theia IDE (same as stage_44rebuild)
│   └── user-platforms/
│       └── skye-account-executive-commandhub-s0l26-0s/  # Only 1 platform here
├── scripts/                               # ~70 older smoke-section* scripts
├── src/runtime.js
├── workspace/prebuilds/, secrets/, volumes/
├── skyequanta.mjs                         # Root orchestration
├── Makefile
└── START_HERE.sh
```

---

## ERRORS IN ORIGINAL DOCS

| Claim | Reality |
|-------|---------|
| stage_44rebuild: 40,530 files | Actually **31,430** |
| Dynasty-Versions: 113,430 files | Actually **77,036** |
| "72,900 files missing" | Wrong — most are present in canonicalAppRoot |
| apps/ COMPLETELY MISSING | **WRONG** — at `recovered_merged/apps/` |
| branding/ COMPLETELY MISSING | **WRONG** — at `recovered_merged/branding/` |
| config/ COMPLETELY MISSING | **WRONG** — at `recovered_merged/config/` |
| platform/user-platforms MISSING | **WRONG** — at `recovered_merged/platform/user-platforms/` with 5 entries |
| "15,000+ files" in user-platforms | **WRONG** — skyehands-codex-* are .mjs files in one folder |
| 13 separate platform directories | **WRONG** — modules are files inside `skyehands-codex-real-platform/` |
| GrayChunks in platform/agent-core | **WRONG** — GrayChunks is in scripts/ with 8 dedicated scripts |
| Only 4 scripts total | **WRONG** — 4 at root (bridge scripts), 223 in canonicalAppRoot |
| SkyeRoutex WHITE_GLOVE V39-V64 | **WRONG** — actual is V39-V78 |
| AE Netlify functions are ae-*.js | **WRONG** — actual are 33 phc-*.js functions |
| "Autonomous agent lane missing" | **WRONG** — present in .skyequanta/ subsystems |
| Sections 81-92 missing | **WRONG** — codex platforms present (different structure than described) |

---

## WHAT ACTUALLY NEEDS TO BE DONE

### Priority 1: Integrate SkyeRoutex (the one real missing piece)
Copy `Dynasty-Versions/SkyeRoutexFlow_v78_unpacked/SkyeRoutexFlow_v69_PLATFORM_HOUSE_CIRCLE_NEON_ENTERPRISE_BACKUP_LANE/` into `recovered_merged/` as a top-level or platform directory. See CODEBASE_REPAIR_EXECUTION_PLAN.md for exact steps.

### Priority 2: Clarify the canonical root structure
The nested structure can confuse future contributors. Consider whether to flatten `SkyeHands_stage40_pass39_rehydrated_live_session/SkyeHands_recovered_merged/` to `stage_44rebuild/` root OR update all docs to clearly describe the canonical root pattern.

### Priority 3: Add missing workspace templates
Copy `Dynasty-Versions/workspace/` into `recovered_merged/workspace/` for prebuild and volume templates.

### Priority 4: Add src/runtime.js
Copy `Dynasty-Versions/src/runtime.js` to `recovered_merged/src/runtime.js`.

### Priority 5 (Optional): Root orchestration scripts
Copy `skyequanta.mjs`, `Makefile` (review for conflicts), `START_HERE.sh` from Dynasty-Versions root if needed.
