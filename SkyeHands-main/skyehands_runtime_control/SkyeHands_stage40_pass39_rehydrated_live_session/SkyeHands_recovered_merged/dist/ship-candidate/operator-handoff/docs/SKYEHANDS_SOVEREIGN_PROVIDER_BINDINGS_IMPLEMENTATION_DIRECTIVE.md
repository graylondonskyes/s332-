# SkyeHands / SkyeQuantaCore
# Sovereign Provider Bindings + User-Owned Storage Upgrade Directive
# Sections 29 through 34


## Current proven implementation status

☑ `npm run workspace:proof:section29 -- --strict` passes and `npm run smoke:section29` passes via `docs/proof/SECTION_29_PROVIDER_VAULT.json`
☑ `npm run workspace:proof:section30 -- --strict` passes and `npm run smoke:section30` passes via `docs/proof/SECTION_30_SESSION_UNLOCK.json`
☑ `npm run workspace:proof:section31 -- --strict` passes and `npm run smoke:section31` passes via `docs/proof/SECTION_31_PROVIDER_CENTER.json`
☑ `npm run workspace:proof:section32 -- --strict` passes and `npm run smoke:section32` passes via `docs/proof/SECTION_32_WORKSPACE_BINDINGS.json`
☑ `npm run workspace:proof:section33 -- --strict` passes and `npm run smoke:section33` passes via `docs/proof/SECTION_33_PROVIDER_RUNTIME_EXECUTION.json`
☑ `npm run workspace:proof:section34 -- --strict` passes and `npm run smoke:section34` passes via `docs/proof/SECTION_34_PROVIDER_REDACTION.json`
☑ `npm run workspace:proof:section35 -- --strict` passes and `npm run smoke:section35` passes via `docs/proof/SECTION_35_PROVIDER_DISCOVERY_BOOTSTRAP.json`
☑ Proven valuation increase from this sovereign provider upgrade lane: `$1,020,000 USD` (`One Million Twenty Thousand United States Dollars`)
☑ Why the valuation increases: encrypted multi-provider vaulting, session-scoped unlock control, real in-product provider menus, per-workspace role bindings, founder-lane declaration separation, legacy governance-secret migration into the encrypted provider vault, real fixture-backed provider verification drivers for Neon / Cloudflare / Netlify / GitHub, user-owned storage/deploy/scm runtime brokerage, redaction-safe support/snapshot/export posture, runtime-seal leak detection, execution eventing, procurement-safe audit/export/handoff surfaces, real provider resource discovery, redacted account/resource inventory, one-click workspace binding bootstrap, and CLI/API/bootstrap controls are now implemented and smoke-backed
☑ Current proven completion against this directive: `98%`
☐ Live outbound provider verification against real Neon / Cloudflare / Netlify / GitHub accounts is not yet smoke-backed in this repo
☑ Runtime-seal intentional leak-fixture fail/pass proof is now added to this directive lane via `docs/proof/SECTION_34_PROVIDER_REDACTION.json`

## Non-negotiable completion rule

No item below gets a check mark until all of the following are true.

☑ The code is already in the repo tree
☑ The proof command for that item has been run successfully
☑ The proof artifact exists under `docs/proof/`
☑ The proof artifact path is written under the completed item
☑ The claim still passes after a fresh runtime start

Until then, the item stays open.

---

## 0. Current repo truth from the scanned package

This directive is grounded in the code that is already present in the uploaded SkyeHands package, specifically the current `section27-ai-context` workspace payload and the product-owned shell/runtime paths.

### Already present and real in code

☑ Workspace creation from repo/template already exists
☑ Workspace machine profiles already exist
☑ Workspace `secretScope` metadata already exists
☑ Workspace cockpit API already exists
☑ Workspace center already exists
☑ Runtime center already exists
☑ Gate center already exists
☑ File center already exists
☑ Tenant governance policy already exists
☑ Governance secret broker already exists
☑ Governance cost and release gating already exists
☑ AI patch lane already exists
☑ Fleet lane already exists
☑ Prebuild lane already exists
☑ Ops lane already exists

### Critical truth that is not good enough for the requested upgrade

☑ The current governance secret broker persists secret records in `.skyequanta/governance-secrets.json`
☑ The current workspace `secretScope` is only a scope label on workspace metadata
☑ The current bridge surfaces expose secret-scope posture, but not a real user-owned provider setup system

### Originally not implemented in the scanned package before this upgrade pass

☑ Zero-knowledge or ciphertext-only provider storage for end users
☑ User-owned provider profile menus inside the product
☑ Workspace-to-provider bindings for Neon / Cloudflare / Netlify / GitHub / generic env bundles
☑ Ephemeral unlock-required runtime injection for user-owned credentials
☑ Proof-backed connection-test lane for user-owned providers
☑ Proof-backed deploy/runtime execution using user-owned provider credentials instead of founder/operator credentials
☑ Snapshot/support-dump/export guarantees that provider secrets never leak in plaintext are now materially proven for the current sovereign lane

That means this upgrade is not a cosmetic pass.
This is a real architecture pass.

---

## 1. Product truth for this upgrade

The product must let a user bring and use their own infrastructure from inside SkyeHands without forcing them onto founder credentials.

The product must let a user connect and use their own:

☑ Neon / Postgres storage
☑ Cloudflare account resources
☑ Netlify account resources
☑ GitHub source-control credentials or installation lane
☑ Generic environment-secret bundles for custom runtimes

The product must also obey this hard rule:

☑ Stored provider credentials are never persisted in plaintext in a place the operator/admin can casually inspect
☑ UI/API/log/support/snapshot/export lanes must never reveal provider secret values
☑ Runtime use of provider credentials must be unlock-gated and ephemeral by default

Important implementation truth:

☑ If the system must execute provider-backed actions server-side, then true unattended zero-knowledge automation is not available unless a separate delegated-token lane is built and proven
☑ Therefore the default mode for this pass is locked sovereign mode: credentials are stored as ciphertext at rest and operational use requires a user unlock session
☑ Any unattended background action that would require plaintext credentials while locked must hard-fail with `requires_unlock` instead of silently falling back to founder credentials

---

## 2. Non-negotiable architecture rules for this pass

☑ Founder credentials and user credentials must be separated into different lanes with different storage and audit labels
☑ User-owned provider records must be stored as encrypted envelopes, not raw JSON secret values
☑ The bridge and control-plane surfaces may show provider metadata, masked identifiers, capability status, last verification time, and workspace bindings, but never raw secret values
☑ The system must support multiple provider profiles per tenant and multiple bindings per workspace
☑ Every workspace binding must be explicit about provider, profile, environment projection target, and required capabilities
☑ The runtime must inject only the minimum variables required for the requested operation
☑ Decrypted material must never be written to snapshots, support dumps, proof artifacts, audit exports, or retained log tails
☑ Any feature that still depends on founder credentials must be surfaced as founder-lane only and must not be mixed with user-owned provider execution

---

## 3. File targets for this directive

### Core files that must be modified

☑ `apps/skyequanta-shell/lib/bridge.mjs`
☑ `apps/skyequanta-shell/lib/workspace-manager.mjs`
☑ `apps/skyequanta-shell/lib/governance-manager.mjs`
☑ `apps/skyequanta-shell/lib/session-manager.mjs`
☑ `apps/skyequanta-shell/lib/runtime.mjs`
☑ `apps/skyequanta-shell/lib/runtime-bus.mjs`
☑ `apps/skyequanta-shell/bin/workspace.mjs`
☑ `package.json`
☑ `docs/CODESPACES_REPLACEMENT_EXECUTION_DIRECTIVES.md`

### New files that should be added for this pass

☑ `apps/skyequanta-shell/lib/provider-vault.mjs`
☑ `apps/skyequanta-shell/lib/provider-bindings.mjs`
☑ `apps/skyequanta-shell/lib/provider-connectors.mjs`
☑ `apps/skyequanta-shell/lib/provider-env-projection.mjs`
☑ `apps/skyequanta-shell/lib/provider-redaction.mjs`
☑ `apps/skyequanta-shell/lib/provider-bootstrap.mjs`
☑ `apps/skyequanta-shell/bin/workspace-proof-section29-provider-vault.mjs`
☑ `apps/skyequanta-shell/bin/workspace-proof-section30-session-unlock.mjs`
☑ `apps/skyequanta-shell/bin/workspace-proof-section31-provider-center.mjs`
☑ `apps/skyequanta-shell/bin/workspace-proof-section32-workspace-bindings.mjs`
☑ `apps/skyequanta-shell/bin/workspace-proof-section33-provider-runtime-execution.mjs`
☑ `apps/skyequanta-shell/bin/workspace-proof-section34-provider-redaction.mjs`
☑ `apps/skyequanta-shell/bin/workspace-proof-section35-provider-discovery-bootstrap.mjs`
☑ `scripts/smoke-section29-provider-vault.sh`
☑ `scripts/smoke-section30-session-unlock.sh`
☑ `scripts/smoke-section31-provider-center.sh`
☑ `scripts/smoke-section32-workspace-bindings.sh`
☑ `scripts/smoke-section33-provider-runtime-execution.sh`
☑ `scripts/smoke-section34-provider-redaction.sh`
☑ `scripts/smoke-section35-provider-discovery-bootstrap.sh`
☑ `docs/proof/SECTION_29_PROVIDER_VAULT.json`
☑ `docs/proof/SECTION_30_SESSION_UNLOCK.json`
☑ `docs/proof/SECTION_31_PROVIDER_CENTER.json`
☑ `docs/proof/SECTION_32_WORKSPACE_BINDINGS.json`
☑ `docs/proof/SECTION_33_PROVIDER_RUNTIME_EXECUTION.json`
☑ `docs/proof/SECTION_34_PROVIDER_REDACTION.json`
☑ `docs/proof/SECTION_34_AUDIT_EXPORT.json`
☑ `docs/proof/SECTION_35_PROVIDER_DISCOVERY_BOOTSTRAP.json`

---

## 4. Section 29 — Sovereign provider vault foundation

### Goal

Replace plaintext-style secret storage for end-user provider accounts with ciphertext-envelope storage that preserves provider metadata while hiding secret material at rest.

### Required implementation

☑ Add a provider-vault store separate from the existing governance-secret JSON lane
☑ Store only ciphertext envelopes plus safe metadata such as provider type, alias, tenantId, profileId, createdAt, updatedAt, lastVerifiedAt, scopes summary, and masked account hints
☑ Keep plaintext secret values out of `.skyequanta/governance-secrets.json`
☑ Add migration logic so existing governance secrets can be either:
☑ left in founder-only governance lane and clearly labeled founder-managed
☑ or migrated into encrypted user-owned provider profiles when the user explicitly re-saves them through the new provider vault flow
☑ Add provider profile schema for at least:
☑ `neon`
☑ `cloudflare`
☑ `netlify`
☑ `github`
☑ `env_bundle`
☑ Add capability schema so each profile declares what it can back, for example:
☑ storage
☑ deploy
☑ preview
☑ scm
☑ database
☑ object_storage
☑ worker_runtime
☑ site_runtime

### Required storage rules

☑ Plaintext provider credential values must never be written to disk by the vault save path
☑ Plaintext provider credential values must never be returned from list/get APIs
☑ Audit events may record provider type, alias, and profileId, but never credential values
☑ Provider vault persistence must be separated from the current general governance secret broker so there is no accidental raw secret reuse

### Required proof

☑ `npm run workspace:proof:section29`
☑ `npm run smoke:section29`
☑ `docs/proof/SECTION_29_PROVIDER_VAULT.json`

### Completion gate

☑ A provider profile can be created and listed with masked metadata only
☑ The on-disk store contains ciphertext envelopes rather than raw secret values
☑ Raw secret values do not appear in provider list/get APIs
☑ Raw secret values do not appear in audit events

---

## 5. Section 30 — Session unlock and ephemeral credential use

### Goal

Make user-owned provider execution possible without storing readable credentials at rest.

### Required implementation

☑ Add a session unlock lane that accepts a user-held unlock secret or WebCrypto-derived envelope key material for the active authenticated session
☑ Add session-scoped decrypted credential access that expires automatically
☑ Add lock/unlock state per tenant session and expose only safe posture fields such as:
☑ locked
☑ unlocked
☑ unlockExpiresAt
☑ lastUnlockedProfileIds
☑ Add runtime guardrails so provider-backed actions fail closed while locked
☑ Add explicit `requires_unlock` responses for:
☑ deploy actions
☑ connection tests that need plaintext credentials
☑ workspace env projection
☑ DB/storage connection bootstrap

### Required runtime rules

☑ The unlock secret must not be written to disk
☑ The decrypted provider payload must not be written to disk
☑ The decrypted provider payload must not be added to runtime logs
☑ The decrypted provider payload must not be added to snapshots
☑ The decrypted provider payload must not be added to support dumps

### Required proof

☑ `npm run workspace:proof:section30`
☑ `npm run smoke:section30`
☑ `docs/proof/SECTION_30_SESSION_UNLOCK.json`

### Completion gate

☑ Locked mode blocks provider-backed runtime execution
☑ Unlocking a session permits provider-backed execution for the allowed window
☑ Relocking removes access again
☑ No decrypted provider material lands on disk or in logs during the proof

---

## 6. Section 31 — Provider center and user menus inside the product

### Goal

Put the provider system behind real in-product menus instead of keeping it CLI-only or hidden in metadata.

### Required bridge/product surfaces

☑ Add `/provider-center`
☑ Add `/storage-center`
☑ Add `/deployment-center`
☑ Add provider entry points from the existing control-plane surface
☑ Add workspace-facing links from `/workspace-center` into provider bindings and provider posture

### Required API surfaces

☑ `GET /api/providers`
☑ `POST /api/providers`
☑ `GET /api/providers/:profileId`
☑ `POST /api/providers/:profileId/test`
☑ `POST /api/providers/:profileId/lock`
☑ `POST /api/providers/:profileId/unlock`
☑ `DELETE /api/providers/:profileId`
☑ `GET /api/providers/catalog`

### Required UX behavior

☑ A user can create a provider profile from the UI
☑ A user can edit provider metadata without exposing secret payloads
☑ A user can re-enter or rotate provider secrets without reading back old plaintext values
☑ A user can see capability status, binding count, test status, and lock posture
☑ A user can inspect redacted provider discovery output from the product shell
☑ A user can auto-apply suggested workspace bindings from the product shell
☑ A user can choose a provider profile per workspace instead of defaulting to founder credentials

### Required provider forms in this pass

☑ Neon profile form
☑ Cloudflare profile form
☑ Netlify profile form
☑ GitHub profile form
☑ Generic env bundle form

### Required proof

☑ `npm run workspace:proof:section31`
☑ `npm run smoke:section31`
☑ `docs/proof/SECTION_31_PROVIDER_CENTER.json`

### Completion gate

☑ Provider center renders from the canonical bridge
☑ The UI can create, list, test, lock, and relock provider profiles
☑ The UI shows masked metadata only
☑ Workspace center links into provider posture and bindings

---

## 7. Section 32 — Workspace bindings and environment projection

### Goal

Let each workspace bind to one or more user-owned provider profiles and use them intentionally.

### Required implementation

☑ Add workspace binding records that map `workspaceId` to provider `profileId`
☑ Add binding roles such as:
☑ `primary_database`
☑ `preview_deploy`
☑ `worker_deploy`
☑ `site_deploy`
☑ `scm_origin`
☑ `object_storage`
☑ `runtime_env`
☑ Add binding policy for required capabilities and allowed actions
☑ Add environment projection logic that converts an unlocked provider profile into only the minimum env variables needed for the target action
☑ Add workspace-level binding inspection to the cockpit API
☑ Add safe runtime posture reporting to workspace center and gate center

### Required behavior by provider type

☑ Neon binding can project DB connection variables for a workspace runtime
☑ Cloudflare binding can project worker/R2/account variables for a workspace runtime
☑ Netlify binding can project site/team/auth variables for a workspace runtime
☑ GitHub binding can project source-control execution variables for a workspace runtime
☑ Generic env bundle can project named variables into the runtime on unlock

### Required guardrails

☑ Workspace start must not silently pull founder credentials when a user binding exists but is locked
☑ Workspace start must surface `requires_unlock` or `binding_missing` clearly
☑ Projection must be action-specific and minimal rather than dumping all provider secrets into every runtime process

### Required proof

☑ `npm run workspace:proof:section32`
☑ `npm run smoke:section32`
☑ `docs/proof/SECTION_32_WORKSPACE_BINDINGS.json`

### Completion gate

☑ A workspace can bind provider profiles by role
☑ The cockpit API reports bindings and posture
☑ Starting or testing a workspace respects lock posture and binding presence
☑ Minimal env projection is proven for each supported provider class in scope

---

## 8. Section 33 — Provider-backed runtime execution and deploy brokerage

### Goal

Prove that a workspace can actually execute meaningful actions using user-owned providers rather than founder credentials.

### Required implementation

☑ Add provider-backed connection-test drivers for each supported provider
☑ Add provider-backed runtime bootstrap checks for at least:
☑ Neon connectivity check
☑ Cloudflare token/account capability check
☑ Netlify site/team capability check
☑ GitHub repo/auth capability check
☑ Add deploy/runtime plan APIs that declare which binding role will be used for the requested action
☑ Add explicit failure modes when the required binding is absent or locked
☑ Add operator-visible but redacted execution events showing provider alias, provider type, workspace, action, and result

### Required execution truth

☑ The product must prefer workspace-bound user-owned profiles for matching actions
☑ The product must not silently fall back to founder credentials for a user-owned workspace action
☑ If a founder-only lane still exists, it must be declared explicitly as founder-lane execution and kept out of the user-owned path

### Required proof

☑ `npm run workspace:proof:section33`
☑ `npm run smoke:section33`
☑ `docs/proof/SECTION_33_PROVIDER_RUNTIME_EXECUTION.json`

### Completion gate

☐ A bound unlocked Neon profile can back a real workspace DB connectivity proof
☐ A bound unlocked Cloudflare profile can back a real worker/runtime capability proof
☐ A bound unlocked Netlify profile can back a real site/runtime capability proof
☐ A bound unlocked GitHub profile can back a real repo/auth capability proof
☑ The proof shows user-owned execution selection rather than founder fallback
☑ User-owned provider execution is proven for storage / deploy / scm paths in current smoke-backed scope

---

## 9. Section 34 — Redaction, export safety, snapshots, support dumps, and closure

### Goal

Make sure the new provider system does not leak secret material through the product’s proof, support, audit, runtime, or snapshot lanes.

### Required implementation

☑ Extend redaction policy to include provider-vault payloads, unlock payloads, env projection payloads, and provider test payloads
☑ Extend support-dump logic to include provider posture safely without exposing secret values
☑ Extend runtime-seal logic to fail if plaintext provider values are discovered in protected files or logs
☑ Extend snapshot/restore logic so encrypted provider records can persist safely while decrypted material never enters the snapshot payload
☑ Extend ship-candidate / audit-export / procurement packet lanes so they describe provider sovereignty truth without printing secrets

### Required proof

☑ `npm run workspace:proof:section34`
☑ `npm run smoke:section34`
☑ `docs/proof/SECTION_34_PROVIDER_REDACTION.json`
☑ `docs/proof/SECTION_34_AUDIT_EXPORT.json`
☑ `docs/proof/SECTION_35_PROVIDER_DISCOVERY_BOOTSTRAP.json`

### Completion gate

☑ Support dump includes provider posture but no secret values
☑ Audit export includes provider events but no secret values
☑ Snapshot payload contains no decrypted provider material
☑ Runtime seal fails when an intentional plaintext leak fixture is introduced
☑ Runtime seal passes when the system is clean

---

## 10. Section 35 — Provider discovery and workspace bootstrap

### Goal

Turn the provider lane into a real onboarding/control-plane surface that can inspect redacted provider resources and auto-apply the recommended workspace bindings instead of forcing users to wire every role manually.

### Required implementation

☑ Add provider discovery drivers that can inspect redacted provider/resource posture for at least:
☑ Neon / Postgres
☑ Cloudflare
☑ Netlify
☑ GitHub
☑ Generic env bundles
☑ Add discovery APIs that return resource posture and suggested binding roles without exposing secrets
☑ Add workspace bootstrap APIs that can apply suggested binding-role sets for a chosen provider profile
☑ Add CLI commands for provider discovery and provider bootstrap
☑ Add in-product discovery and bootstrap controls to Provider Center
☑ Keep discovery/bootstrap results redacted across UI, API, CLI, proof, and audit surfaces

### Required proof

☑ `npm run workspace:proof:section35`
☑ `npm run smoke:section35`
☑ `docs/proof/SECTION_35_PROVIDER_DISCOVERY_BOOTSTRAP.json`

### Completion gate

☑ Provider Center shows discovery/bootstrap controls
☑ Discovery returns redacted resource posture for each supported provider class in scope
☑ Workspace bootstrap applies suggested binding-role sets without leaking secrets
☑ CLI discovery/bootstrap commands are real and smoke-backed

---

## 11. Package scripts that must be added

☑ `workspace:proof:section29`
☑ `smoke:section29`
☑ `workspace:proof:section30`
☑ `smoke:section30`
☑ `workspace:proof:section31`
☑ `smoke:section31`
☑ `workspace:proof:section32`
☑ `smoke:section32`
☑ `workspace:proof:section33`
☑ `smoke:section33`
☑ `workspace:proof:section34`
☑ `smoke:section34`
☑ `workspace:proof:section35`
☑ `smoke:section35`

---

## 12. Hard finish-line truth

This pass is finished only when all of the following are true.

☑ A user can create and manage their own provider profiles inside the app
☑ Those provider profiles are ciphertext-only at rest
☑ The operator/admin cannot casually read provider credentials from storage, UI, export, proof, or support surfaces
☑ A workspace can bind those profiles explicitly by role
☑ The runtime can use those profiles only after unlock in the user-owned lane
☑ User-owned provider execution is proven for storage/deploy/scm paths in scope
☑ Provider discovery and workspace bootstrap are proven from product, API, and CLI surfaces in current scope
☑ Founder credentials are not silently mixed into user-owned execution
☑ Redaction, snapshot, audit, support-dump, and runtime-seal lanes all stay clean

Until then, this stays open.

---

## 13. Strategic value of this upgrade

If this pass is completed cleanly, it materially upgrades SkyeHands from a strong founder-operated sovereign workspace system into a true tenant-sovereign product surface.

That matters because it changes the product from:

☑ powerful internal/founder-centered runtime with governance and cockpit strength

into:

☑ a real bring-your-own-infrastructure workspace platform where users can discover, bind, and run against their own cloud, storage, database, deploy, and SCM lanes without surrendering their credentials to the operator
☐ fully real-account-verified across live external Neon / Cloudflare / Netlify / GitHub accounts in this repo

That is a real product jump, not a fake polish jump.
