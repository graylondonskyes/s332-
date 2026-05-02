# Seven-Zip Platform Placement Map - 2026-04-29

Scope: placement plan for the seven audited donor archives only.

## Whole-Platform Principle

Use SkyeHands as the runtime authority:

- auth
- tenant/org/workspace identity
- provider gateway
- audit/events
- persistent records
- vault/secrets
- proof artifacts
- app registry

The donor zips should become modules, services, or UI donors. They should not each bring their own independent auth, database, provider keys, or user model.

This map should be read as part of the bigger SkyeHands ecosystem, not just the seven zips. The repo already has native signals for:

- sovereign runtime
- provider sovereignty
- provider vault
- valuation audit mode
- deep scan mode
- platform launchpad
- platform power mesh
- Skye Foundry
- AE Central / AE-FLOW

That means two things change from the first placement pass:

1. **Valuation Certification should become a full platform family**, not merely an internal proof tool.
2. **Sovereign Variables should become a Sovereign Primitives layer**, not merely a House Command app.

## Platform Families

Think of the ecosystem as several product families sharing one SkyeHands substrate.

| Platform Family | Purpose | Donor Zips That Feed It |
| --- | --- | --- |
| **SkyeHands Core Runtime** | Auth, workspace, provider gateway, audit, vault, app registry, artifact storage | all seven indirectly |
| **Sovereign Primitives** | Environment variables, provider bindings, vault records, signed handoffs, deployment proofs, portable `.skye` packages | `sovereign-variables-main.zip` |
| **Valuation Certification Platform** | Code intake, proof packs, readiness scoring, repair intelligence, valuation/audit ledgers, trust surfaces, portfolio views | `SkyeHands_Valuation_Certification_System_v0_7_0_proved_full (1).zip`, Dead Route Detector |
| **Quality Gate Platform** | Broken route detection, command wiring audits, SARIF/CI export, regression comparison | `dead-route-detector-skyevsx-product-proofpack-v0.6.0.zip` |
| **AE Central / AE-FLOW** | Intake, account/project workspaces, growth research, content planning, publish payloads, role assistants | `skye-geo-engine-starter-v20-source-only.zip`, `FunnelSystem-main.zip`, Artificial Sole concept |
| **House Command** | Executive/operator dashboard over tasks, intake, vault, proof, growth, and assistant workflows | GrayScape, Sovereign Variables, FunnelSystem, Artificial Sole concept |
| **SuperIDE / Builder Workbench** | Developer surface for editing, env vault, scans, certification, repairs, deployment | Dead Route Detector, Valuation Certification, Sovereign Variables |
| **SkyeSol / Public Layer** | Public forms, product surfaces, client-facing reports, selected proof outputs | rebuilt FunnelSystem, polished GEO outputs, selected Valuation reports |

## Best Platform Homes

| Donor Zip | Best Home | Secondary Home | Role |
| --- | --- | --- | --- |
| `dead-route-detector-skyevsx-product-proofpack-v0.6.0.zip` | SkyeHands core quality/proof layer | SuperIDE, House Command, AE Central | Scan app modules for broken routes, dead commands, placeholder links, and CI/SARIF findings. |
| `skye-geo-engine-starter-v20-source-only.zip` | AE Central / AE-FLOW | House Command growth ops | Growth/content/search visibility engine: audits, research, content plans, briefs, drafts, publish payloads. |
| `SkyeHands_Valuation_Certification_System_v0_7_0_proved_full (1).zip` | Valuation Certification Platform | SkyeHands proof/audit, SuperIDE import center | Full product lane for code intake, readiness scoring, proof packs, portfolio certification, repair intelligence, and audit-grade reporting. |
| `sovereign-variables-main.zip` | Sovereign Primitives | House Command env/deployment vault, SuperIDE workspace settings | Env variables, provider bindings, encrypted `.skye` handoff, deployment notes, vault workflow, portable workspace primitives. |
| `GrayScape_SuperApp_Spectacle.zip` | House Command shell/UI donor | personal operator dashboard | Visual command shell, PWA interaction model, tasks/journal/vault ideas. |
| `FunnelSystem-main.zip` | AE Central / House Command intake | SkyeSol lead capture | Intake schema and funnel concept. Must be rebuilt because zip is incomplete. |
| `artificial-sole-api-main.zip` | AE Central persona assistant feature | House Command operator assistant | Persona/role-agent concept only. Do not keep its standalone backend. |

## 1. SkyeHands Core Quality / Proof Layer

### Put Here

- Dead Route Detector
- Valuation Certification System
- selected Sovereign Variables export metadata

### Why

This is the defensive layer. It keeps every other platform honest.

Dead Route Detector finds broken UI and command wiring. Valuation Certification packages readiness/proof/repair intelligence. Sovereign Variables can contribute environment/deployment evidence, but only after hardening.

### Proposed SkyeHands Modules

- `quality.deadRoutes`
- `proof.certification`
- `proof.artifacts`
- `proof.repairPlans`
- `vault.envEvidence`

### Backend Contracts Needed

- `workspace_id`
- `org_id`
- `actor_id`
- artifact storage
- scan job history
- audit events
- permission-gated download/export

### First Useful Product Outcome

Every imported app or donor module gets a "SkyeHands Proof Check":

1. Upload or select code.
2. Run Dead Route Detector.
3. Run Valuation/Readiness scan.
4. Produce proof pack.
5. Produce repair plan.
6. Store results in workspace audit history.

## 1A. Valuation Certification As A Full Platform

### Product Position

Valuation Certification should become its own full platform, not a background report generator.

Working name options:

- `SkyeValuation`
- `SkyeCertify`
- `SkyeProof`
- `SkyeHands Valuation Certification`
- `AboveTheSkye Certification`

The serious positioning is:

> A proof, readiness, repair, and portfolio certification platform for software assets.

It can still include valuation language, but it should distinguish:

- **technical readiness value**
- **platform integration value**
- **repair delta**
- **portfolio value**
- **investor narrative support**
- **not a formal legal/tax appraisal**

### Full Platform Capabilities

Valuation Certification should have these first-class product areas:

- **Asset Intake**: upload zip, import repo, select SkyeHands app, select platform module.
- **Truth Scan**: file inventory, route scan, dependency graph, launch profile, env needs, backend claims.
- **Quality Gate**: Dead Route Detector integration, smoke/test status, broken path/command report.
- **Readiness Score**: transparent weighted scoring with visible methods.
- **Repair Intelligence**: deterministic repair suggestions, patch diffs, updated codebase exports.
- **Proof Pack Builder**: VCS artifacts, audit surfaces, HTML report, JSON ledgers, signed bundle.
- **Portfolio Certification**: compare multiple apps/assets, track trends, rank assets by readiness and repair ROI.
- **Sovereign Evidence Binder**: provider/env/deployment proof pulled from Sovereign Primitives.
- **Public Trust Surface**: sanitized client/investor-facing proof pages.
- **Admin Methodology Center**: weights, scoring formulas, claim labels, disclaimers, evidence requirements.

### Where It Lives

It should exist in three forms:

- **Standalone platform**: a full product surface in the app registry.
- **SuperIDE panel**: "Certify Workspace" / "Analyze Zip".
- **SkyeHands core service**: API and job runner used by other apps.

### Backend Contracts Needed

- `asset_id`
- `portfolio_id`
- `workspace_id`
- `org_id`
- `certification_run_id`
- `methodology_version`
- `artifact_bundle_id`
- `dead_route_scan_id`
- `sovereign_evidence_id`
- `repair_plan_id`

### What Makes It Real

To graduate from useful tool to full platform:

1. Run on actual donor zips and SkyeHands modules, not only fixtures.
2. Store every run as an immutable audit record.
3. Version every methodology and scoring formula.
4. Separate "technical certification" from "financial valuation."
5. Generate human-readable and machine-readable proof packs.
6. Integrate Dead Route Detector and Sovereign Primitives as evidence inputs.
7. Add portfolio dashboards, not just single-project reports.

## 1B. Sovereign Variables As Sovereign Primitives

### Product Position

Sovereign Variables should not be thought of as only an env-variable app. The repo already has sovereign runtime/provider/vault signals, so this should become the **Sovereign Primitives** layer.

Sovereign Primitives are the portable, auditable building blocks every platform can inherit:

- environment variables
- provider bindings
- secrets references
- deployment notes
- workspace identity
- auth policy references
- `.skye` handoff packages
- redaction policies
- vault records
- proof attachments

### Relationship To Existing SkyeHands Concepts

The existing repo signals suggest this should connect to:

- `skye-sovereign-runtime`
- `provider-sovereignty`
- `provider-vault`
- Section 50 sovereign runtime proof
- Section 60 valuation audit mode
- SkyeQuanta workspace/runtime bus

So the donor zip is not the final architecture. It is the UI/package donor for primitives SkyeHands already wants.

### Where It Lives

Sovereign Primitives should exist in four forms:

- **Core library/service**: canonical records and APIs.
- **House Command app**: human-friendly env/deployment vault.
- **SuperIDE panel**: builder-facing env/provider bindings.
- **Valuation Certification evidence source**: env/deploy/provider proof included in certification packs.

### Proposed Primitive Types

- `sovereign.envSet`
- `sovereign.variable`
- `sovereign.providerBinding`
- `sovereign.secretReference`
- `sovereign.deploymentNote`
- `sovereign.handoffPackage`
- `sovereign.redactionPolicy`
- `sovereign.auditEvidence`

### What To Preserve From The Zip

- project/environment model
- `.env` import/export
- `.json` import/export
- `.skye` package marker/concept
- AES-GCM export flow as a starting point
- VS Code extension wrapper idea
- standalone PWA idea

### What Must Change

- localStorage cannot be the source of truth.
- prompt-based passphrase UX should become a proper secret flow.
- chat/mail pushes need redaction and policy gates.
- exported packages need metadata and audit IDs.
- provider bindings should be references, not raw secrets scattered through apps.

## 2. SuperIDE / Developer Workbench

### Put Here

- Dead Route Detector as IDE command/panel.
- Valuation Certification as "Analyze Zip / Certify Workspace".
- Sovereign Variables as "Env Vault" panel.

### Why

SuperIDE is the operator/developer surface where people will actually inspect, repair, and ship code. These tools are useful while editing/building.

### UI Placement

- Left rail: `Quality`
- Left rail: `Proof`
- Workspace toolbar: `Scan Routes`
- Workspace toolbar: `Certify`
- Settings/deploy panel: `Env Vault`

### What Not To Do

Do not bring Artificial Sole API here as its own backend. If persona assistance appears in SuperIDE, it should be a SkyeHands provider-gateway assistant with workspace context and protected-file rules.

## 3. AE Central / AE-FLOW

### Put Here

- Skye GEO Engine
- FunnelSystem concept/schema
- Artificial Sole persona assistant concept
- Dead Route Detector for AE app QA

### Why

AE Central is the strongest home for growth/ops workflows: intake, account research, content planning, follow-up, publish payloads, and role-based operator support.

### Product Shape

AE Central should become:

- lead/intake capture
- account/project workspace
- research ledger
- visibility audit
- content plan
- article brief/draft
- publish payload
- follow-up assistant
- proof/QA check before handoff

### Donor-to-Feature Mapping

- FunnelSystem -> `Intake`
- Skye GEO Engine -> `Growth Engine`
- Artificial Sole API -> `Role Assistant`
- Dead Route Detector -> `Release QA`

### Artificial Sole Placement

Use it as a feature called something like:

- `AE Role Assistant`
- `Executive Persona Assistant`
- `Operator Profile Agent`

Do not call it a real clone engine. The current zip is just persona prompt wrapping. In AE Central, it could help draft follow-up, summarize account strategy, or answer in a selected operator style.

### Backend Contracts Needed

- `account_id`
- `workspace_id`
- `intake_submission_id`
- `research_source_id`
- `content_plan_id`
- provider gateway request
- audit event
- publish payload records

## 4. House Command

### Put Here

- GrayScape shell concepts
- Sovereign Variables
- FunnelSystem intake cards
- Artificial Sole as operator assistant concept
- Skye GEO summary widgets

### Why

House Command should feel like the executive/operator dashboard. GrayScape gives a vibe and interaction model, Sovereign Variables gives deployment control, FunnelSystem gives intake flow, and Artificial Sole can become a role-guided assistant once rebuilt.

### Product Shape

House Command should have:

- Command home
- Intake inbox
- Tasks/journal/notes
- Env/deployment vault
- Growth status widgets
- Proof status widgets
- Operator assistant

### What To Reuse From GrayScape

Reuse:

- command palette
- PWA shell behavior
- module dock idea
- task/journal/vault concepts

Replace:

- localStorage-only storage
- fake vault lock
- CDN Three.js dependency
- isolated static pages

### What To Reuse From Sovereign Variables

Reuse:

- `.env` import/export
- `.skye` package format concept
- AES-GCM browser export logic as a starting point
- project/environment model

Replace/harden:

- localStorage primary storage
- prompt-based secret UX
- broad extension CSP
- chat/mail secret sharing without redaction

## 5. SkyeSol / Public Platform Layer

### Put Here

- Public-facing intake forms rebuilt from FunnelSystem.
- Public product-facing parts of Skye GEO outputs.
- Maybe a polished GrayScape-inspired public PWA only if it has real data.

### Do Not Put Here Yet

- Artificial Sole API as public service.
- Sovereign Variables raw secret workflows.
- Valuation Certification public valuation claims.

Public layer should show outcomes, not raw internals.

## Integration Priority

### Phase 1: Quality First

1. Extract Dead Route Detector into a controlled donor work area.
2. Wrap scanner core behind SkyeHands auth/workspace job API.
3. Run it against all six other zips after extraction.
4. Store JSON/Markdown/SARIF artifacts.

Why first: it reduces risk across every other integration.

### Phase 2: AE Central Growth Spine

1. Mount Skye GEO Engine behind SkyeHands workspace IDs.
2. Prove live DB mode, not just memory-mode smoke.
3. Rebuild FunnelSystem intake into AE Central.
4. Connect intake -> project -> research -> content plan -> publish payload.

Why second: this gives the most operational/business utility.

### Phase 3: House Command Operator Shell

1. Build House Command dashboard using GrayScape only as design/interaction donor.
2. Add Sovereign Variables as the real env/deployment vault module.
3. Add intake inbox from rebuilt FunnelSystem.
4. Add proof/growth status widgets from Phase 1/2.

Why third: dashboard makes sense once real records exist.

### Phase 4: Proof / Certification

1. Mount Valuation Certification as "Readiness Certification".
2. Clean up valuation language.
3. Run it on actual SkyeHands modules and donor zips.
4. Generate proof packs tied to SkyeHands audit IDs.

Why fourth: it becomes much more credible after live module integration.

### Phase 5: Persona Assistant

1. Discard Artificial Sole's standalone backend.
2. Keep the persona profile schema idea.
3. Rebuild as a SkyeHands provider-gateway assistant.
4. Add persistence, tenancy, audit, rate limits, and explicit "not a real person" guardrails.

Why last: current code is too thin; it should ride on SkyeHands infrastructure.

## Concrete Route / Module Naming

Suggested internal module IDs:

- `skye.quality.deadRouteDetector`
- `skye.proof.readinessCertification`
- `skye.growth.geoEngine`
- `skye.intake.funnel`
- `skye.vault.sovereignVariables`
- `skye.house.commandShell`
- `skye.assistant.personaRoles`

Suggested app labels:

- `Quality Gate`
- `Readiness Certification`
- `GEO Growth Engine`
- `Intake`
- `Env Vault`
- `House Command`
- `Role Assistant`

## What Each Platform Should Inherit From SkyeHands

| Module | Must Inherit |
| --- | --- |
| Dead Route Detector | auth, workspace file access, job queue, artifact storage, audit events |
| Skye GEO Engine | auth, tenant/project IDs, provider gateway, database, publishing permissions |
| Valuation Certification | workspace import permissions, artifact storage, audit chain, claim labels |
| Sovereign Variables | vault storage, encryption policy, secret classification, export audit |
| GrayScape | real records, auth, routing, app registry |
| FunnelSystem | auth, tenant IDs, rate limits, intake workflow, notification hooks |
| Artificial Sole | provider gateway, persona records, safety policy, audit, rate limits |

## Sharp Calls

- Dead Route Detector belongs everywhere, but its code should live once in SkyeHands quality services.
- Skye GEO Engine is AE Central's biggest win.
- Sovereign Variables is House Command/SuperIDE infrastructure, not a toy app.
- GrayScape is a shell donor, not a data platform.
- FunnelSystem must be rebuilt because the archive is incomplete.
- Artificial Sole API should be absorbed as a feature idea, not deployed as-is.
- Valuation Certification should be renamed/framed as readiness certification unless there is a formal valuation workflow later.
