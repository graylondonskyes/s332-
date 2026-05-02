# Seven-Zip Integration Implementation Backlog

This backlog turns the unpacked donor zips into SkyeHands platform work.

## Phase 0 - Guardrails

- Keep donor code isolated under `_integration_workspace/seven-zips-unpacked`.
- Do not deploy donor backends directly.
- Do not preserve independent provider-key paths where SkyeHands provider gateway should own calls.
- Do not preserve localStorage as the long-term source of truth for platform modules.
- Do not use "valuation" claims without methodology version, evidence artifacts, and disclaimers.

## Phase 1 - Sovereign Primitives Foundation

Goal: make Sovereign Variables into reusable platform primitives.

Tasks:

- Define record contracts:
  - `sovereign.envSet`
  - `sovereign.variable`
  - `sovereign.providerBinding`
  - `sovereign.secretReference`
  - `sovereign.deploymentNote`
  - `sovereign.handoffPackage`
  - `sovereign.redactionPolicy`
  - `sovereign.auditEvidence`
- Map existing SkyeHands sovereign/provider/vault runtime files to these contracts.
- Extract import/export logic from `sovereign-variables-main/media/app/app.js`.
- Preserve `.env`, `.json`, and `.skye` package compatibility.
- Replace localStorage with SkyeHands workspace records.
- Add audit events for import, export, share, decrypt, and vault update.
- Add redaction rules before any SkyeMail/SkyeChat handoff.

Acceptance:

- A workspace can create an env set through SkyeHands records.
- A `.env` import becomes workspace-owned primitive records.
- A `.skye` export includes workspace/artifact/audit metadata.
- No raw provider secret is sent to chat/mail without explicit policy.

## Phase 2 - Quality Gate Platform

Goal: make Dead Route Detector a shared SkyeHands quality service.

Tasks:

- Identify the smallest reusable scanner entrypoint in:
  - `dead-route-detector-skyevsx-product/shared/scanner-core.js`
  - `dead-route-detector-skyevsx-product/shared/report-tools.js`
- Wrap scanner execution in a SkyeHands job contract.
- Store outputs as artifacts:
  - JSON
  - Markdown
  - SARIF
  - diff JSON
  - diff Markdown
- Add scan records keyed by `workspace_id`, `asset_id`, and `scan_id`.
- Run it against the six other unpacked donor directories.
- Feed scan IDs into Valuation Certification.

Acceptance:

- SkyeHands can scan an unpacked donor path.
- Results are saved as artifacts.
- SARIF output is generated or preserved.
- A scan can be referenced by Valuation Certification.

## Phase 3 - Valuation Certification Platform

Goal: promote Valuation Certification into a full platform.

Tasks:

- Treat `valuation-certification/skyehands-valuation-certification-system` as the seed app.
- Rename outward language where needed:
  - "Valuation Certification" can stay as product family.
  - "formal appraisal" claims must not appear.
  - "readiness certification", "technical value support", and "portfolio scoring" should be the operational language.
- Define records:
  - `asset_id`
  - `portfolio_id`
  - `certification_run_id`
  - `methodology_version`
  - `artifact_bundle_id`
  - `quality_scan_id`
  - `sovereign_evidence_id`
  - `repair_plan_id`
- Add platform areas:
  - Asset Intake
  - Truth Scan
  - Quality Gate
  - Readiness Score
  - Repair Intelligence
  - Proof Pack Builder
  - Portfolio Certification
  - Sovereign Evidence Binder
  - Public Trust Surface
  - Methodology Center
- Run it against the six other unpacked donors.

Acceptance:

- A donor zip or unpacked path can produce a certification run.
- A run can include Dead Route scan results.
- A run can include Sovereign Primitive evidence.
- A portfolio view can compare multiple assets.

## Phase 4 - AE Central Growth Spine

Goal: mount Skye GEO Engine and rebuilt intake as AE Central workflows.

Tasks:

- Use `skye-geo-engine-starter-v20` as the growth engine donor.
- Bind routes to SkyeHands auth/workspaces/projects.
- Prove live DB mode; do not rely only on memory-mode smoke.
- Rebuild FunnelSystem because the archive is incomplete:
  - public forms
  - submission API
  - admin review UI
  - rate/spam controls
  - workflow hooks
- Connect flow:
  - intake -> project -> research -> content plan -> brief -> draft -> publish payload.
- Rebuild Artificial Sole as `Role Assistant`, not as standalone API.

Acceptance:

- An intake submission becomes an AE Central project.
- A project can run a GEO audit/content plan.
- A publish payload can be stored under the project.
- A role assistant can draft/follow up through SkyeHands provider gateway.

## Phase 5 - House Command

Goal: make House Command the operator dashboard over real records.

Tasks:

- Use GrayScape as interaction/design donor only.
- Rebuild command palette against SkyeHands app registry.
- Replace localStorage tasks/journal/vault with SkyeHands records.
- Add widgets:
  - intake inbox
  - env/deployment vault
  - growth status
  - proof/certification status
  - quality scan status
  - role assistant
- Remove CDN dependency for Three.js if keeping 3D visuals.

Acceptance:

- House Command displays live SkyeHands records.
- Vault uses Sovereign Primitives.
- Proof widgets link to Valuation Certification runs.
- Growth widgets link to AE Central projects.

## Phase 6 - SuperIDE

Goal: expose builder-facing controls.

Tasks:

- Add `Quality` panel for Dead Route scans.
- Add `Certify Workspace` panel for Valuation Certification.
- Add `Env Vault` panel for Sovereign Primitives.
- Connect repair plans to workspace patch review.
- Connect deployment handoff to `.skye` packages and audit evidence.

Acceptance:

- Developer can scan current workspace.
- Developer can certify current workspace.
- Developer can manage env/provider bindings.
- Developer can export an audited deployment handoff.

## Phase 7 - Public Layer

Goal: expose selected outputs safely.

Tasks:

- Rebuild public intake forms from FunnelSystem concept.
- Publish selected GEO reports.
- Publish sanitized certification/proof pages.
- Avoid raw secrets, internal methods, and demo assistant APIs.

Acceptance:

- Public pages show outcomes, not internals.
- Every public report links back to an internal artifact/audit ID.

