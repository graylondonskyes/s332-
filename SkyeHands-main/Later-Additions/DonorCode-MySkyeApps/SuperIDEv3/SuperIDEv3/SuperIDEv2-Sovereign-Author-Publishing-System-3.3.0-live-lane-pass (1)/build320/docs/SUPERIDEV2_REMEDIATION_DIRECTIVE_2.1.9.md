# SUPERIDEV2 REMEDIATION DIRECTIVE 2.2.0

## RELEASE PROOF HARDENING
- [x] Add canonical release scan manifest so donor and archival lanes do not poison canonical release endpoint policy gates.
- [x] Rebaseline protected app integrity manifest from current shipped protected surface hash.
- [x] Add deterministic protected-app manifest updater for future proof regeneration.
- [x] Replace smoke snapshot name-only validation with smoke contract validation that requires executable smoke specs and interaction primitives.
- [x] Add one-command contract proof runner that executes release-critical code checks and writes a fresh artifact.
- [x] Add true authenticated browser E2E smoke execution for release gating inside this repo.
- [x] Add fresh same-run UI smoke artifact enforcement inside release gates.

## SECURITY AND POLICY NORMALIZATION
- [x] Make external endpoint policy scan respect the canonical release manifest instead of donor lane residue.
- [x] Remove or normalize raw provider donor code inside excluded archival lanes instead of merely excluding it from canonical release gates.
- [x] Close remaining P0 hardening items in docs/HARDENING_TODO.md.

## EVIDENCE PACK
- [x] Regenerate protected app proof against current tree.
- [x] Regenerate contract proof artifact against current tree.
- [x] Regenerate release checklist against current tree.
- [x] Regenerate release gates against current tree.
- [x] Regenerate fresh browser UI smoke artifacts against current tree.
