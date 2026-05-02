# Featured-on-SkyeSol Estate Classification

Reviewed: 2026-05-01
Scope: `AbovetheSkye-Platforms/Featured-on-SkyeSol`

## Purpose

This file is the quick-read classification companion to `SkyeSol-Inventory`.
Use it when deciding whether a surface should be described as shipped, partial,
or concept/demo.

## Canonical Evidence Source

The detailed evidence and product-by-product reasoning live in:

- `Featured-on-SkyeSol/SkyeSol-Inventory`

If a public claim conflicts with that inventory, the inventory wins.

## Classification Rules

- `shipped-core`: meaningful implementation and evidence of real app/backend behavior
- `partial-tool`: useful working surface, but smaller, thinner, or heavily dependent on shared infrastructure
- `concept-demo-sales`: static, editorial, sales, release, or front-end-heavy surfaces that read bigger than the code proves

## Current Classification

### Shipped Core

- `SkyeRoutex`
- `skyeroutex-workforce-command-v0.4.0`
- `SkyeGateFS13`
- `kAIxUGateway13`
- `SkyeWebCreatorMax`
- `SkyDexia`
- `AppointmentSetter`
- `JobPing`
- `MaggiesStore`
- `SkyeDocxMax`

These are the strongest candidates for platform claims because they already have
meaningful runtime wiring and smoke-proof work elsewhere in the workspace.

### Partial Tool / Utility / Frontend-Dominant

- `GateProofx`
- `kAIxU-PDF-Pro`
- `kAIxUBrandKit`
- `SkyeProofx`
- `SovereignVariables`
- `LocalSeoSnapshot`
- `BusinessLaunchGo`

These can be described as real tools, but not as evidence that the entire estate
is production-complete.

### Concept / Demo / Sales / Static

- most `2026` release/demo pages
- most one-file or brochure-style app fronts
- sales-offer families presented as if they are already separate product lines
- editorial, valuation, profile, or proof pages that are not backed by platform-specific smoke evidence

## Strongest Overstatement Risks

- describing the whole folder as a uniformly finished platform catalog
- treating every named surface as a separate shipped product
- using sales-pack language as if it proves deployed application depth
- presenting release/demo mirrors as canonical runtime surfaces

## Audit Rule

Before a surface is promoted from `concept-demo-sales` to `partial-tool` or
`shipped-core`, it should have:

1. a clear canonical folder
2. a local proof or smoke command
3. a status note describing what is and is not implemented

## Unresolved Categories

- duplicate naming across suite mirrors, release mirrors, and standalone lanes
- concept-heavy pages that still read like product claims
- folders with no local proof contract of their own
