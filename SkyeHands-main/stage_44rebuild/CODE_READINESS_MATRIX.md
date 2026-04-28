# CODE READINESS MATRIX

_Generated: 2026-04-27T22:59:12.788Z_

> **GrayChunks Reality Scanner** — grades are code-backed, not manually written.

## Platform Grades

| Platform | Grade | Backend | Persist | Providers | UI | Behavioral Smoke | Stub Files | Mock Integrations | TODO/FIXMEs | Violations |
|----------|-------|---------|---------|-----------|-----|-----------------|------------|-------------------|-------------|------------|
| Theia IDE (ide-core) | **PRODUCTION-READY** | 15 | 35 | 33 | 1708 | 1 | 0 | 0 | 164 | 0 |
| OpenHands Agent (agent-core) | **PRODUCTION-READY** | 2 | 5 | 1 | 2 | 1 | 0 | 0 | 2 | 0 |
| AE Command Hub | **PRODUCTION-READY** | 37 | 10 | 8 | 100 | 32 | 0 | 0 | 54 | 0 |
| SkyeHands Platform Bus | **PRODUCTION-READY** | 2 | 1 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| AI Appointment Setter | **PRODUCTION-READY** | 1 | 1 | 0 | 12 | 1 | 0 | 0 | 14 | 0 |
| Printful Commerce Brain | **PRODUCTION-READY** | 32 | 2 | 43 | 55 | 1 | 0 | 0 | 16 | 0 |
| Maggies Autonomous Store | **PRODUCTION-READY** | 6 | 6 | 1 | 15 | 4 | 0 | 0 | 6 | 0 |
| Lead Vault CRM | **PRODUCTION-READY** | 4 | 2 | 1 | 5 | 1 | 0 | 0 | 4 | 0 |
| Media Center | **PRODUCTION-READY** | 5 | 2 | 1 | 6 | 1 | 0 | 0 | 4 | 0 |
| Music Nexus | **PRODUCTION-READY** | 5 | 5 | 1 | 6 | 1 | 0 | 0 | 4 | 0 |
| SkyDexia Code Generation | **PRODUCTION-READY** | 138 | 5 | 2 | 2 | 1 | 0 | 0 | 10 | 0 |
| SkyeRoutex Platform House Circle | **PRODUCTION-READY** | 52 | 9 | 3 | 59 | 3 | 0 | 0 | 28 | 0 |

## Runtime Proof Flags

### Theia IDE (ide-core)

`fullTheiaRuntime`: **☐ NOT PROVEN**

- ☐ `resolvedTheiaCli`
- ☐ `backendLaunches`
- ☐ `browserLaunches`
- ☐ `workspaceOpens`
- ☐ `fileSave`
- ☐ `terminalCommand`
- ☐ `previewOutput`

### OpenHands Agent (agent-core)

`fullOpenHandsRuntime`: **☐ NOT PROVEN**

- ☐ `packageImportable`
- ☐ `serverLaunches`
- ☐ `taskReceived`
- ☐ `workspaceFileSeen`
- ☐ `fileEditedOrGenerated`
- ☐ `commandOrTestRun`
- ☐ `resultReturnedToSkyeHands`

## GrayChunks Violations

_No violations detected._

## Donor Lane Status

| Platform | Donor Lane Status | Full Runtime Proven |
|----------|-------------------|--------------------|
| Theia IDE (ide-core) | existing-source | ☐ |
| OpenHands Agent (agent-core) | runtime-shim | ☐ |
| SkyeRoutex Platform House Circle | v83-bullshit-removed | ☐ |
