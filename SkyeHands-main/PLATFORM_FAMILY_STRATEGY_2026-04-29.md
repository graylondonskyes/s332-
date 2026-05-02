# Platform Family Strategy - 2026-04-29

This is the whole-system view for placing the seven audited donor zips into the broader SkyeHands ecosystem.

## The Big Idea

SkyeHands should not become one giant tangled app. It should become a platform substrate with several product families on top.

The shared substrate:

- identity/auth
- workspaces
- provider gateway
- audit chain
- runtime bus
- app registry
- vault/secrets
- artifact storage
- proof and certification records
- billing/entitlement later

The product families:

- SkyeHands Core Runtime
- Sovereign Primitives
- Valuation Certification Platform
- Quality Gate Platform
- AE Central / AE-FLOW
- House Command
- SuperIDE / Builder Workbench
- SkyeSol / Public Layer

## Product Family Roles

### SkyeHands Core Runtime

The shared operating layer. Everything inherits this.

Owns:

- auth
- users/orgs/workspaces
- permissions
- audit/events
- provider gateway
- vault/encrypted records
- app/module registry
- artifact store
- job runner contracts

No donor zip should bypass this.

### Sovereign Primitives

This is where `sovereign-variables-main.zip` should mature.

It becomes the canonical primitive system for:

- env sets
- variables
- provider bindings
- secret references
- deployment notes
- redaction policy
- `.skye` handoff packages
- proof attachments

This should connect to the repo's existing sovereign runtime/provider/vault concepts.

Primary surfaces:

- House Command env/deployment vault
- SuperIDE env/provider panel
- Valuation Certification evidence binder
- SkyeHands backend primitive APIs

### Valuation Certification Platform

This should be a full platform, not just a proof sidecar.

Owns:

- asset intake
- zip/repo/module scanning
- readiness scoring
- technical valuation/support scoring
- repair intelligence
- patch output
- proof pack generation
- portfolio certification
- public trust/report surfaces
- methodology center

Important framing:

- It can support valuation narratives.
- It should not pretend to be a formal legal/tax appraisal.
- Scores must be transparent and methodology-versioned.

Primary surfaces:

- standalone app
- SuperIDE "Certify Workspace"
- SkyeHands proof API
- House Command portfolio/proof dashboard

### Quality Gate Platform

This is where Dead Route Detector lives.

Owns:

- dead route scans
- command wiring scans
- placeholder UI checks
- SARIF output
- CI export
- regression comparison
- PR review comment generation

It feeds Valuation Certification and protects every app family.

### AE Central / AE-FLOW

This is the account/growth/operator workflow platform.

Donor inputs:

- Skye GEO Engine
- FunnelSystem concept/schema
- Artificial Sole persona concept
- Dead Route Detector QA

Owns:

- intake
- account/project workspace
- research/source ledger
- visibility audit
- content plan
- article brief/draft
- publish payload
- role assistant
- follow-up workflows

### House Command

This is the executive/operator dashboard.

Donor inputs:

- GrayScape shell concepts
- Sovereign Primitives
- FunnelSystem intake
- Artificial Sole role assistant concept
- Skye GEO status summaries
- Valuation/Proof status summaries

Owns:

- command home
- task/notes/journal
- intake inbox
- env/deploy vault
- proof dashboard
- growth dashboard
- operator assistant

GrayScape should be design/interaction donor, not the data architecture.

### SuperIDE / Builder Workbench

This is the build/repair/deployment workbench.

Owns:

- workspace editor
- env/provider panel
- route/quality scans
- certify workspace
- repair plans
- patch review
- deployment handoff

Donor integrations:

- Dead Route Detector
- Sovereign Primitives
- Valuation Certification

### SkyeSol / Public Layer

This is public/client-facing presentation and intake.

Can expose:

- rebuilt FunnelSystem public forms
- selected GEO reports
- public proof/trust pages
- polished product surfaces

Should not expose raw:

- secrets
- provider bindings
- internal valuation methods without context
- Artificial Sole demo API

## Where The Seven Zips Land

| Zip | Final Role |
| --- | --- |
| `dead-route-detector-skyevsx-product-proofpack-v0.6.0.zip` | Quality Gate Platform core |
| `skye-geo-engine-starter-v20-source-only.zip` | AE Central growth engine |
| `SkyeHands_Valuation_Certification_System_v0_7_0_proved_full (1).zip` | Valuation Certification Platform seed |
| `sovereign-variables-main.zip` | Sovereign Primitives seed |
| `GrayScape_SuperApp_Spectacle.zip` | House Command UI/interaction donor |
| `FunnelSystem-main.zip` | Intake schema/concept donor |
| `artificial-sole-api-main.zip` | Persona/role assistant concept donor |

## Strategic Build Sequence

1. **Sovereign Primitives foundation**
   - Define env/provider/vault/handoff records.
   - Map existing sovereign runtime/provider-vault concepts.
   - Use Sovereign Variables as UI/import/export donor.

2. **Quality Gate**
   - Integrate Dead Route Detector scanner core.
   - Store scan artifacts and audit events.
   - Make it callable by SuperIDE, Valuation, AE Central, House Command.

3. **Valuation Certification Platform**
   - Promote from proof sidecar to standalone app.
   - Add asset intake, portfolio dashboard, methodology center.
   - Feed it Dead Route scans and Sovereign evidence.

4. **AE Central Growth Spine**
   - Mount GEO Engine behind SkyeHands workspace/project/auth.
   - Rebuild FunnelSystem intake.
   - Add role assistant from Artificial Sole concept.

5. **House Command**
   - Build dashboard after real records exist.
   - Use GrayScape interaction ideas.
   - Surface intake, proof, growth, env vault, assistant.

6. **SuperIDE**
   - Add Quality, Certify, Env Vault panels.
   - Connect repair intelligence and deployment handoff.

7. **Public Layer**
   - Publish selected forms, reports, trust surfaces, and product pages.

## Core Decision

Valuation Certification and Sovereign Primitives are not "side features."

They are platform infrastructure:

- Sovereign Primitives defines what a workspace/app needs to run safely.
- Quality Gate defines whether an app is wired honestly.
- Valuation Certification defines what an app is worth, ready for, missing, and provably capable of.

Everything else can plug into that triangle.

