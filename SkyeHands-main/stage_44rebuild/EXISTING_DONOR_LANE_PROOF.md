# EXISTING DONOR LANE PROOF

_Generated per directive section 1 — Corrected Truth_
_As-of: 2026-04-26_

## Purpose

This document inventories what is present, what is wired, what is only
metadata/source, and what proof flags are still false for the two existing
donor lanes: Theia (ide-core) and OpenHands (agent-core).

Do NOT treat either lane as a missing external repo. Both are already inside
the SkyeHands repo and require installation, runtime wiring, and behavioral proof.

---

## Theia IDE Lane (`platform/ide-core/`)

### Classification: `existing-source`

### What is present

| Item | Status |
|------|--------|
| `platform/ide-core/packages/` | ✅ Directory exists |
| `platform/ide-core/node_modules/` | ✅ Directory exists (partial or full) |
| `platform/ide-core/examples/` | ✅ Directory exists |
| Theia monorepo package.json | ✅ Identifies lane as `@theia/monorepo` |

### What is NOT wired / NOT proven

| Proof Flag | Status | Required Action |
|------------|--------|-----------------|
| `resolvedTheiaCli` | ☐ NULL | Run `npx theia --version` or resolve via yarn workspaces; write result |
| `backendLaunches` | ☐ NOT PROVEN | `theia start` or equivalent must produce a running backend process |
| `browserLaunches` | ☐ NOT PROVEN | Browser must load IDE at localhost and return 200 |
| `workspaceOpens` | ☐ NOT PROVEN | A SkyeHands workspace directory must mount in the IDE |
| `fileSave` | ☐ NOT PROVEN | A file write through the IDE must persist to workspace filesystem |
| `terminalCommand` | ☐ NOT PROVEN | Terminal panel must execute a command and return output |
| `previewOutput` | ☐ NOT PROVEN | Generated app preview must be routable from the IDE |

### Runtime Proof File Location

`platform/ide-core/runtime-proof.json` — does not exist yet, must be written by smoke script.

### Required Implementation Files

- `platform/ide-core/scripts/theia-install-proof.mjs` — validates install, writes CLI resolution
- `platform/ide-core/scripts/theia-smoke.mjs` — proves all 7 proof flags, writes `runtime-proof.json`

---

## OpenHands Agent Lane (`platform/agent-core/`)

### Classification: `runtime-shim`

### What is present

| Item | Status |
|------|--------|
| `platform/agent-core/pyproject.toml` | ✅ Identifies lane as `openhands-ai` |
| `platform/agent-core/config.toml` | ✅ Config structure exists |
| `platform/agent-core/runtime/lib/server.mjs` | ✅ Boundary shim exists |

### What is NOT wired / NOT proven

| Proof Flag | Status | Required Action |
|------------|--------|-----------------|
| `packageImportable` | ☐ NOT PROVEN | `python -c "import openhands"` must succeed |
| `serverLaunches` | ☐ NOT PROVEN | OpenHands app/server entrypoint must start and expose local API |
| `taskReceived` | ☐ NOT PROVEN | SkyeHands must be able to send a task and OpenHands must receive it |
| `workspaceFileSeen` | ☐ NOT PROVEN | OpenHands must read a workspace file through its sandbox |
| `fileEditedOrGenerated` | ☐ NOT PROVEN | OpenHands must write or generate a file in the workspace |
| `commandOrTestRun` | ☐ NOT PROVEN | OpenHands must execute a shell command or test within workspace sandbox |
| `resultReturnedToSkyeHands` | ☐ NOT PROVEN | Structured result (files changed, stdout, exit code, smoke result) returned |

### Runtime Proof File Location

`platform/agent-core/runtime-proof.json` — does not exist yet.

### Boundary Shim Status

`platform/agent-core/runtime/lib/server.mjs` remains a boundary shim.
It MUST NOT be upgraded to claim production status until all 7 proof flags above are true
and `fullOpenHandsRuntime: true` is written to `runtime-proof.json` by behavioral smoke.

### Required Implementation Files

- `platform/agent-core/scripts/openhands-install-proof.mjs` — validates pip install, writes import test result
- `platform/agent-core/scripts/openhands-smoke.mjs` — proves all 7 proof flags, writes `runtime-proof.json`

---

## GrayChunks Rules for Donor Lanes

Per directive section 14.1:

- Any doc/UI claim of Theia runtime parity requires proof flags for: CLI resolution, backend launch, browser launch, workspace mount, file save, terminal command, preview — ALL must be `true`
- Any doc/UI claim of OpenHands runtime parity requires: import proof, server/runtime launch, task execution, workspace mutation, command/test, result ledger — ALL must be `true`
- Any open-source donor recommendation must first check whether that donor lane already exists inside SkyeHands and label it as: `existing-source`, `metadata-only`, `runtime-shim`, or `fully-wired`
