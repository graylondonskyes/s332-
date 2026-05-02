# 01 — DIRECTIVE-FIRST CANON

## What the build actually is
The product is **one offline-first field system** made of two already-existing apps:
- **AE FLOW** = account, visit, follow-up, and route-prep control surface.
- **Skye Routex** = route execution, field logging, proof, economics, and closeout surface.

The goal is not to create a third product.
The goal is not to import whole donor apps.
The goal is not to stuff random premium-looking features into the UI.
The goal is to finish the **AE FLOW + Routex system already in this ZIP**.

## Correct use of Project Docs
Project Docs are allowed for:
- modal mechanics
- task / reminder structures
- storage and merge patterns
- dashboard card patterns
- doc-vault attachment handling
- export / ledger / print patterns
- offline backup / restore / import / duplicate-warning patterns
- UI shell patterns only where they help the existing app surface

Project Docs are **not** allowed for:
- importing unrelated product identity
- renaming this app into something else
- carrying over foreign user journeys that do not belong to AE FLOW or Routex
- dragging in whole donor navigation systems, branding systems, or disconnected feature bundles

## Correct order of work
### Layer 1 — fix the system contract
Before any new front-end lane is called done:
- outcome states need one source of truth
- quick actions need storage, UI confirmation, and export behavior
- exact vs partial vs territory-fallback location status must be explicit
- new, legacy, backup/export, and restore behavior must be defined

### Layer 2 — complete directive lanes in order
1. P0 route economics
2. P1 field operations
3. P2 territory intelligence and route-building
4. P3 field desk / proof system
5. P4 analytics / command layer
6. section 8 killer upgrades
7. section 9 optional hybrid tie-ins only after offline lanes are stable

### Layer 3 — only then allow optional expansion
The old `extra-shit` folder becomes eligible only **after** the directive lane it depends on is grounded.

## Product boundaries by app
### AE FLOW owns
- account records
- visit records
- account history rollup
- readiness scoring presentation
- route-prep selection
- task lists and due work presentation
- cadence / stale / revisit account surfaces
- saved views / dossier / account organization

### Routex owns
- route records
- stop records
- field-time execution
- odometer / fuel / expense / materials / collections
- proof, signatures, service summaries, route packs
- closeout, day ledger, economics, analytics snapshots
- inventory + vehicle operational state

### Shared contract between both apps
Shared items must stay canonical across both apps:
- `clientKey`
- route / stop linkage
- route activity events
- follow-up tasks created from field work
- location quality state
- document linkage metadata
- exportable client identity fields

## What “started” means in this packet
A task is considered “started” only when all of these are defined:
- target app surface
- storage path
- export impact
- restore / import behavior
- acceptance proof

If one of those is missing, the task is not really started.
