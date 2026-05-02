# 07 — DONOR USAGE RULES — NO FRANKENSTEIN

Use donor packs only as pattern donors.

## Allowed donor sources from Project Docs
Priority order:
1. `SuperIDEv2-full-2026-03-09.zip`
2. modular lane packs / modular atlas splits
3. `kAIx4nthi4-4.6-deep-refactor.zip`
4. newer platform-control / ops packs only when a matching plumbing lane exists

## Allowed donor extraction types
- modal state pattern
- task / reminder state shape
- backup / restore merge preview pattern
- export / print / summary generation pattern
- dashboard card and analytics layout pattern
- media attachment and compression pattern
- audit trail / timeline pattern

## Forbidden donor behavior
- do not import whole pages because they look advanced
- do not import unrelated menus
- do not import unrelated route-less or account-less workflows
- do not rename AE FLOW or Routex around donor jargon
- do not let donor storage keys overwrite the existing AE FLOW / Routex keys

## Implementation rule
For each donor-assisted lane, write it this way:
- take the **behavior pattern**
- rebuild it inside the existing AE FLOW or Routex surface
- map it to the canonical keys in `02-CANONICAL-DATA-CONTRACT.md`
- do not expose donor identity in the shipped app

## Correct examples
- use a merge-preview pattern from a donor pack to finish Routex route-pack import preview
- use a reminder/task pattern from a donor pack to finish AE FLOW reminder center
- use a doc-generation pattern from a donor pack to finish signed service summary generation

## Wrong examples
- importing a donor dashboard screen into Routex because it already has charts
- importing a donor app shell into AE FLOW because it has nice panes
- copying a donor workflow that changes what the product actually is
