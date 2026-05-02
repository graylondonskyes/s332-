# AE-Central-CommandHub Classification

Reviewed: 2026-05-01
Scope: `AbovetheSkye-Platforms/AE-Central-CommandHub`

## Purpose

This folder is best understood as an offline-first command shell plus bundled
walkthrough packs. It should not be described as a uniformly finished suite of
independent shipped platforms.

## Classification Rules

- `working-shell`: usable launcher or local utility shell with meaningful offline behavior
- `walkthrough-pack`: guided, tutorial, or bundled app lane that demonstrates a flow but is not certified here as a shipped platform
- `guide-sales-doc`: narrative or packaging surface describing work rather than proving it end to end

## Current Classification

### Working Shell

- `AE-Central-Command-Pack-CredentialHub-Launcher`
  - Evidence: main app shell, PWA manifest, service worker, assets, page partials, local storage style features.
  - Limits: it is a launcher/workstation shell, not proof that every bundled branch app is fully built out.

### Walkthrough Packs

- `Branching Apps/Skye-Lead-Vault-Offline-Phase2-with-Walkthrough`
- `Branching Apps/Skye-OfferForge-SkyDexia-Offline-Upgrade-v4-WalkthroughTutorial`
- `Branching Apps/Skye-Split-Engine-Offline-Money-Ops-Walkthrough`
- `Branching Apps/SkyeBox-Command-Vault`
- `Branching Apps/SkyePortal-Control-Plane-Vault-Workstation-v5-tutorial`

These are the strongest overstatement risk in the tree if described as shipped
products. Their names, bundled pages, and tutorial framing indicate walkthrough,
offline, or upgrade-pack status rather than independently smoke-certified
production systems.

### Guide / Sales / Packaging Surfaces

- `Branching Apps/ae-service-pack-master`
  - This is a structured service-pack and roadmap family, not a single proven application runtime.

- launcher guide pages such as:
  - `pages/ae-command-pack.html`
  - `pages/ops-pack.html`
  - `pages/service-pack.html`
  - `pages/tutorial.html`
  - `pages/sitemap.html`

These pages are useful and intentional, but they describe or package the system
more than they prove the downstream branch apps are complete.

## Strongest Overstatement Risks

- reading the launcher as proof that every bundled branch app is shipped
- treating walkthrough/tutorial packs as if they are production-certified apps
- treating roadmap/service-pack pages as runtime evidence

## Audit Rule

Promote a branch app out of `walkthrough-pack` only after it has:

1. a local smoke or proof contract
2. a status note naming what is local-only, tutorial-only, or unfinished
3. evidence that it is more than a guided or packaging surface

## Major Unresolved Categories

- bundled branch apps without local smoke contracts
- tutorial and walkthrough naming that can be mistaken for shipped product naming
- launcher copy that can be read too broadly without this classification layer
