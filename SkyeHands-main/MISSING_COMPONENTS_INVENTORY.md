# MISSING COMPONENTS — ACCURATE INVENTORY (CORRECTED)

Generated: April 25, 2026 (corrected from April 24 — previous version was significantly wrong)

---

## IMPORTANT: CANONICAL APP ROOT

Before reading this inventory, understand the repo structure:

```
stage_44rebuild/skyehands.repo.config.json declares:
  canonicalAppRoot = "SkyeHands_stage40_pass39_rehydrated_live_session/SkyeHands_recovered_merged"
```

Most components the original docs listed as "missing" are present at the canonical app root. The previous inventory was written without knowledge of this structure and is substantially incorrect.

---

## COMPONENTS THAT ARE PRESENT (Wrongly Listed as Missing)

### ✅ apps/ — PRESENT
**Location:** `stage_44rebuild/SkyeHands_stage40_pass39_rehydrated_live_session/SkyeHands_recovered_merged/apps/`
- `skye-reader-hardened/` — Enterprise document reader
- `skyequanta-shell/` — CLI interface for skyequanta

### ✅ branding/ — PRESENT
**Location:** `...recovered_merged/branding/`
- Brand assets, visual identity

### ✅ config/ — PRESENT
**Location:** `...recovered_merged/config/`
- `agent/` — Agent configuration
- `env-templates/` — Environment variable templates

### ✅ platform/user-platforms — PRESENT
**Location:** `...recovered_merged/platform/user-platforms/`
- `ae-autonomous-store-system-maggies/` — Autonomous store system
- `skye-account-executive-commandhub-s0l26-0s/` — AE Command Hub (full + netlify functions)
- `skyehands-codex-competitor/` — Codex competitor platform
- `skyehands-codex-control-plane/` — Codex control plane
- `skyehands-codex-real-platform/` — Real platform with all .mjs modules:
  - skyehands-billing-webhooks.mjs
  - skyehands-browser-ide.mjs
  - skyehands-deploy-automation.mjs
  - skyehands-isolation-controller.mjs
  - skyehands-oauth-gateway.mjs
  - skyehands-platform-core.mjs
  - skyehands-platform-db.mjs
  - skyehands-provider-router.mjs
  - skyehands-sandbox-runner.mjs
  - migrations/001_skyehands_codex_platform_core.sql

### ✅ scripts — PRESENT (223 scripts)
**Location:** `...recovered_merged/scripts/`
- Full smoke test suite (smoke-p001 through smoke-p088+)
- GrayChunks platform scripts (8 scripts)
- Directive scripts
- Bootstrap/setup scripts
- Skydexia admin scripts
- 223 total

### ✅ .skyequanta — PRESENT (19 subsystems)
**Location:** `...recovered_merged/.skyequanta/`
- autonomous-maintenance ✅
- autonomy-gradient ✅
- cache ✅
- compliance-native-modes ✅
- deal-ownership-generation ✅
- deep-scan-mode ✅
- devglow ✅
- environment-mirror ✅
- ide-config ✅
- kaixu-council ✅
- memory-fabric ✅
- platform-launchpad ✅
- remote-executor ✅
- reports ✅
- runtime-bus ✅
- runtime-deps ✅
- runtime-recovery ✅
- skye-foundry ✅
- skye-reader-bridge ✅
- workspace-runtime ✅

### ✅ GrayChunks Platform — PRESENT AND COMPLETE
**Location:** `...recovered_merged/scripts/graychunks-*.mjs` + `recovered_merged/skydexia/alerts/`
- graychunks-core.mjs ✅
- graychunks-platform-server.mjs ✅
- graychunks-autofix.mjs ✅
- graychunks-runtime-cycle.mjs ✅
- graychunks-alert-resend.mjs ✅
- graychunks-priority-queue.mjs ✅
- graychunks-progress-dashboard.mjs ✅
- graychunks-scan.mjs ✅
- smoke-p085 through smoke-p088 ✅
- graychunks.config.json ✅
- skydexia/alerts/graychunks-*.json ✅
- ae-graychunks-control.js (AE Hub integration) ✅

### ✅ skydexia/ — PRESENT
**Location:** `...recovered_merged/skydexia/`
- alerts/, donors/, extracted-templates/, generated-projects/, integration/
- knowledge-base/, knowledge-updates/, policies/, proofs/, provenance/

### ✅ Autonomous Agent Lane — PRESENT
`.skyequanta/autonomous-maintenance/` and `.skyequanta/autonomy-gradient/` are both present.

---

## COMPONENTS THAT ARE ACTUALLY MISSING

### 1. SkyeRoutex Platform — CRITICAL (486 files)

**Status:** ❌ NOT in stage_44rebuild anywhere
**Source:** `Dynasty-Versions/SkyeRoutexFlow_v78_unpacked/SkyeRoutexFlow_v69_PLATFORM_HOUSE_CIRCLE_NEON_ENTERPRISE_BACKUP_LANE/`
**Priority:** 🔴 CRITICAL

**Full contents:**
```
SkyeRoutexFlow_v69_.../
├── AE-FLOW/AE-Flow/                       # PWA app
│   ├── index.html, manifest.webmanifest, sw.js
│   ├── 0s-auth-sdk/index.js
│   └── icons (apple-touch, icon-192/512, maskable)
├── SkyeRoutex/                            # Core routing platform
│   ├── WHITE_GLOVE_V64/                   # White-glove service docs
│   ├── WHITE_GLOVE_V65/
│   ├── WHITE_GLOVE_V66/
│   ├── WHITE_GLOVE_V67/
│   ├── WHITE_GLOVE_V68/
│   ├── WHITE_GLOVE_V69/
│   ├── WHITE_GLOVE_V77/
│   ├── WHITE_GLOVE_V78/                   # Latest version
│   ├── app-fabric/adapters/               # App fabric layer
│   ├── apps/audit-ready-console/          # Audit console
│   ├── apps/smoke-dropin-v77/             # Smoke drop-in
│   ├── assets/, icons/, neon/
│   ├── investor/                          # Enterprise valuation docs
│   ├── netlify/.phc_app_fabric_v77/
│   ├── netlify/.phc_data/
│   ├── netlify/functions/                 # 33 phc-* Netlify functions:
│   │   ├── phc-app-fabric-*.js (15 functions)
│   │   ├── phc-auth-login.js, phc-auth-mfa-*.js
│   │   ├── phc-event-feed.js, phc-health.js
│   │   ├── phc-neon-*.js, phc-pos-ingest.js
│   │   ├── phc-sync-frame.js, phc-device-register.js
│   │   └── ... (33 total)
│   └── operator/                          # Master walkthroughs V67/V69
├── AuditReadyConsole-main/                # Audit console app
├── NEW-SHIT2/                             # New features folder
├── WHITE_GLOVE_V39/ through V63/          # Legacy service docs (25 versions)
├── skyesol-whiteglove-bookings/           # Bookings service
│   ├── README.md, contract.json, index.js
├── skyesol-whiteglove-dispatch/           # Dispatch service
├── skyesol-whiteglove-memberships/        # Memberships service
├── skyesol-whiteglove-payments/           # Payments service
├── skyesol-whiteglove-runtime/shared.js   # Shared runtime
├── skyesol-whiteglove-sync/               # Sync service
└── extra-shit/                            # Integration audit docs
```

**Integration point:** AE-Flow connects to AE Command Hub. Skylane services need wiring config.

---

### 2. workspace/ Templates — NEEDED

**Status:** ❌ Not in stage_44rebuild
**Source:** `Dynasty-Versions/workspace/`
**Priority:** ⚠️ NEEDED for runtime

```
workspace/
├── prebuilds/
│   ├── local-default/prebuild-manifest.json
│   ├── remote-default/prebuild-manifest.json
│   ├── preview-stage8/prebuild-manifest.json
│   └── pass38-fallback-*/prebuild-manifest.json
├── secrets/
│   ├── local-default/workspace.secrets.env
│   ├── remote-default/workspace.secrets.env
│   ├── preview-stage8/workspace.secrets.env
│   └── pass38-fallback-*/workspace.secrets.env
└── volumes/
    ├── local-default/config/*.json
    ├── remote-default/config/*.json
    └── preview-stage8/config/*.json
```

---

### 3. src/runtime.js — NEEDED

**Status:** ❌ Not in stage_44rebuild
**Source:** `Dynasty-Versions/src/runtime.js`
**Priority:** ⚠️ NEEDED for builds
**Note:** This is a single file — Dynasty-Versions/src/ only contains this one file.

---

### 4. Root Orchestration Files — OPTIONAL

**Status:** ❌ Not at stage_44rebuild root (recovered_merged has its own Makefile)
**Source:** `Dynasty-Versions/`
- `skyequanta.mjs` — Root orchestration script
- `START_HERE.sh` — Bootstrap helper

**Note:** The `recovered_merged/Makefile` likely supersedes the Dynasty-Versions Makefile. Review before copying.

---

### 5. Root .skyequanta Governance State Files — OPTIONAL

**Status:** Exists in Dynasty-Versions root but not in stage_44rebuild
**Source:** `Dynasty-Versions/.skyequanta/`
- `fleet-state.json`
- `governance-policy.json`, `governance-cost-ledger.json`
- `governance-secrets.json`, `governance-release-decisions.json`
- `governance-tenant-policies.json`
- `collaboration-state.json`
- `ops-state.json`
- `workspace-scheduler-policy.json`, `workspace-scheduler-state.json`
- `snapshot-retention.json`, `sessions.json`, `workspaces.json`
- `scm-state.json`, `prebuild-state.json`

**Note:** These are runtime state files, not source code. They may need to be initialized fresh rather than copied.

---

## DYNASTY-VERSIONS EXTRA REFERENCE ARCHIVES (Do NOT blindly merge)

Dynasty-Versions contains three archived builds that should be used as REFERENCE ONLY:

- `SkyeHands_3_1_9_unpacked/work/` — Earliest build
- `SkyeHandsunf/SkyeHands-main_stage40_pass35_evidence_closure_source/` — Stage 40 pass 35
- `SkyeHands_stage40_pass41_unpacked/SkyeHands-main_stage40_pass35_evidence_closure_source/` — Stage 40 pass 41

**The stage_44rebuild recovered_merged is NEWER than all of these. Do not use these as the merge source.**

---

## CORRECTED SUMMARY TABLE

| Component | Status | Location | Priority | Action |
|-----------|--------|----------|----------|--------|
| apps/ | ✅ PRESENT | recovered_merged/apps/ | — | None |
| branding/ | ✅ PRESENT | recovered_merged/branding/ | — | None |
| config/ | ✅ PRESENT | recovered_merged/config/ | — | None |
| platform/user-platforms | ✅ PRESENT (5 entries) | recovered_merged/platform/user-platforms/ | — | None |
| scripts | ✅ PRESENT (223 scripts) | recovered_merged/scripts/ | — | None |
| .skyequanta (19 subsystems) | ✅ PRESENT | recovered_merged/.skyequanta/ | — | None |
| GrayChunks | ✅ FULLY BUILT | recovered_merged/scripts/graychunks-* | — | Preserve |
| Autonomous Agent Lane | ✅ PRESENT | recovered_merged/.skyequanta/ | — | None |
| **SkyeRoutex (486 files)** | ❌ **MISSING** | Dynasty-Versions/SkyeRoutexFlow_v78_unpacked/ | 🔴 CRITICAL | Integrate |
| workspace/ templates | ❌ Missing | Dynasty-Versions/workspace/ | ⚠️ NEEDED | Copy |
| src/runtime.js | ❌ Missing | Dynasty-Versions/src/ | ⚠️ NEEDED | Copy |
| skyequanta.mjs | ❌ Missing | Dynasty-Versions/ root | 🟡 OPTIONAL | Review |
| Root governance state | ❌ Missing | Dynasty-Versions/.skyequanta/ | 🟡 OPTIONAL | Init fresh |

**Total ACTUALLY missing: ~490 files (SkyeRoutex 486 + workspace ~30 + src 1)**
**Previous claim of "72,900 missing" was wrong.**
