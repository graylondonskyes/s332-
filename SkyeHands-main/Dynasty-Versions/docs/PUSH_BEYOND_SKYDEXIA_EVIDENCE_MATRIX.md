# Push Beyond · SkyDexia Evidence Matrix

This file exists so the Push Beyond work stops pretending certain managed-platform lanes are missing when SkyDexia already owns them.

Rule: **import first, rebuild only when there is no donor**.

## Git workspace contract and branch/tag operations
- Donor proven: ✅
- Converged into SkyeHands: ✅
- Primary evidence: docs/SKYDEXIA-2.6-GIT-OPERATOR-GUIDE.md + scripts/verify-git-workflow.js + scripts/verify-git-history-ops.js + scripts/verify-git-branching-tags.js
- Source lanes: server.js git API block; ui/partials/git-workspace.html; scripts/verify-git-*.js
- Required action: Import SkyDexia git contract first; do not rebuild branch, stash, rebase, cherry-pick, remotes, tag, and conflict lanes from scratch.

## GitHub connect and push lane
- Donor proven: ✅
- Converged into SkyeHands: ✅
- Primary evidence: scripts/verify.js, scripts/verify-git-push.js, docs/SKYDEXIA-2.6-DEPLOYMENT-GUIDE.md phase 5
- Source lanes: netlify/functions/github-app-connect.js; netlify/functions/github-push.js; server.js /api/github-app-connect and /api/github-push
- Required action: Adopt the saved-workspace-to-GitHub push truth path and carry deferred behavior forward instead of fabricating success.

## Netlify connect and deploy lane
- Donor proven: ✅
- Converged into SkyeHands: ✅
- Primary evidence: scripts/verify.js, docs/SKYDEXIA-2.6-DEPLOYMENT-GUIDE.md phase 6
- Source lanes: netlify/functions/netlify-connect.js; netlify/functions/netlify-deploy.js; server.js release handling
- Required action: Import the saved-snapshot deploy lane and preserve release history and returned deploy URLs.

## Deferred release queue and replay
- Donor proven: ✅
- Converged into SkyeHands: ✅
- Primary evidence: docs/SKYDEXIA-MUSTBe-PERFECT; scripts/verify-release-queue.js; scripts/verify.js replay assertions
- Source lanes: netlify/functions/release-replay.js; release queue/history UI; integrations status route
- Required action: Carry queue, replay, and history into SkyeHands as the canonical release truth path. Never claim completed release when adapters are absent.

## Hosted durable state and storage migration
- Donor proven: ✅
- Converged into SkyeHands: ✅
- Primary evidence: scripts/verify-hosted.js; scripts/verify-storage-migration.js; docs/SKYDEXIA-2.6-DEPLOYMENT-GUIDE.md hosted persistence section
- Source lanes: scripts/migrate-storage.js; scripts/inspect-storage-backend.js; Postgres storage contract in deployment guide
- Required action: Import the storage backend contract, inspection route, and migration path before adding fleet or collaboration state.

## Runtime profiles, presets, and task recipes
- Donor proven: ✅
- Converged into SkyeHands: ✅
- Primary evidence: docs/SKYDEXIA-MUSTBe-PERFECT saved workbench profile coverage; scripts/verify-runtime-lifecycle.js
- Source lanes: .skydexia/workbench.json semantics; server.js runtime routes; runtime presets and templates
- Required action: Merge SkyDexia workbench profiles into SkyeHands canonical operator path so machine profiles are built on real runtime contracts, not invented UI only.

## Crash recovery and task recovery
- Donor proven: ✅
- Converged into SkyeHands: ✅
- Primary evidence: scripts/verify-crash-recovery.js; scripts/verify-task-recovery.js
- Source lanes: server.js runtime lifecycle persistence; hosted recovery metadata
- Required action: Adopt recovery primitives before collaboration or prebuild work so multi-operator state is not built on a brittle runtime floor.

## Hardening, audit logs, autonomy fallback
- Donor proven: ✅
- Converged into SkyeHands: ✅
- Primary evidence: scripts/verify-hardening.js; scripts/verify-autonomy-fallback.js; scripts/verify-audit-logs.js
- Source lanes: server.js audit routes; fallback policy scripts; docs/SKYDEXIA-2.6-AUTONOMY-AUDIT.md
- Required action: Keep SkyDexia fallback and audit behavior as mandatory guardrails for every push-beyond lane.

## Workspace map cache and self-contained package contract
- Donor proven: ✅
- Converged into SkyeHands: ✅
- Primary evidence: scripts/verify-workspace-map-cache.js; docs/SKYDEXIA-2.6-SELF-CONTAINED-CONTRACT.md
- Source lanes: netlify/functions/workspace-map-cache.js; self-contained contract docs
- Required action: Use SkyDexia workspace map and self-contained contract to drive repo cartography and donor import decisions.

## What still requires net-new build beyond SkyDexia
- Donor proven: ☐
- Converged into SkyeHands: ☐
- Primary evidence: No clean donor proof found in this pass
- Source lanes: tenant governance plane; secret brokerage; release governance; final parity-plus gate
- Required action: These are the true next-level build lanes. Only start them after donor-backed convergence from the rows above is landed.
