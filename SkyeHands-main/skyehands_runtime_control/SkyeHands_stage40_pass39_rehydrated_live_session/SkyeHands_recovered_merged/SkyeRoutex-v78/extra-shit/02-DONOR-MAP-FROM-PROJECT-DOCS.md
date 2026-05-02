# DONOR MAP FROM PROJECT DOCS

This file maps the remaining directive work to the project-doc donors that should be mined first.

## Donor 1 — SuperIDEv2-full-2026-03-09.zip
Use for:
- fixture-driven test planning
- import/export proof contract planning
- hardening / smoke matrix discipline
- multi-panel shell patterns

Known useful paths:
- `docs/export-import-fixtures.json`
- `docs/SMOKE_CONTRACT_MATRIX.md`
- `docs/HARDENING_TODO.md`
- `public/`

Why this donor:
It is the newer 2026 pack the user explicitly pointed to, and it is the best source here for test gates, proof discipline, and non-handwavy release structure.

## Donor 2 — skyetime-hour-logger.zip
Use for:
- time math
- duration formatting
- proof export logic
- line-based offline PDF generation
- session/day rollup patterns

Known useful paths:
- `skyetime-hour-logger/src/lib/core.js`
- `skyetime-hour-logger/public/index.html`
- `skyetime-hour-logger/README.md`
- `skyetime-hour-logger/START_HERE.md`

Why this donor:
It is already an offline field-style logger with proof exports and time/session structure. That makes it the cleanest donor for signed service summary generation, trip/day rollups, and score inputs.

## Donor 3 — SkyeVaultPro-vaultedskye.netlify.app-drive.zip
Use for:
- local vault persistence
- blobs/media/doc storage
- generated document persistence
- backup shape ideas
- restore-safe local storage patterns

Known useful paths:
- `assets/js/local-vault.js`
- `assets/js/hosted-bridge.js`
- `drive/index.html`
- `apps/docx/index.html`
- `netlify/functions/vault-backup.mjs`

Why this donor:
The remaining roadmap heavily depends on document and media integrity. This donor is the cleanest local-vault pattern in the available pack set.

## Donor 4 — skydex3.2-agent-command-deck-upgrade.zip
Use for:
- command deck UI patterns
- board surfaces
- dossier-style layouts
- mobile/operator panel behavior

Known useful paths:
- `index.html`
- `manifest.json`
- `sw.js`
- `dev notes/upgrades`
- `other apps/`

Why this donor:
The remaining blanks need operator-first surfaces more than deep backend work. This donor is the right source for board view, QR lookup surface, and account heat UI.

## Donor 5 — FULLY AGENTsuperide-agent.zip
Use only for future optional hybrid lanes:
- device sync concepts
- notification/account adapters
- auth-bound optional integrations

Known useful paths:
- `netlify/functions/auth-*`
- `netlify/functions/workspace-share.js`
- `netlify/functions/health.js`
- `netlify/functions/invite-*`

Why this donor:
Useful later, but too heavy for the offline MVP core. Keep it out until the offline source of truth is locked.

## Donor 6 — kAIx4nthi4-4.6-deep-refactor.zip
Use only for future optional hybrid lanes:
- older login / identity / gated-control patterns
- optional remote adapter ideas

Known useful paths:
- `solesheetslogin/netlify/functions/*`
- `xnthgateway/netlify/functions/*`

Why this donor:
It may help for later adapters, but it should not be allowed to contaminate the offline-first MVP core.

## Hard donor rules
- Extract named modules only.
- Do not merge whole apps.
- Keep one runtime, one naming system, one storage contract.
- Do not let hybrid donors become the offline source of truth.
- Prefer the smallest donor that solves the actual remaining blank item.
