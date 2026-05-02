# SECTION 47 — SKYE REPLAY DIRECTIVE

## Required implementation

☑ Capture ordered replay events for planning, file reads, file writes, command start/exit, test failure, policy denial, approvals, deploys, and runtime transitions
☑ Add checkpoint snapshots plus diffs between checkpoints instead of only final-state storage
☑ Add replay timeline UI with scrubber, event list, diff view, terminal view, and checkpoint jump controls
☑ Add replay export bundle for debugging, procurement, and proof packs
☑ Add replay fork capability so a run can be resumed from a chosen checkpoint under different model, policy, or budget conditions
☑ Add replay verification digest so event tampering is detectable

## Required smoke proof

☑ Execute a real fixture task run
☑ Persist ordered replay events
☑ Reconstruct file state at step N
☑ Reconstruct terminal output at step N
☑ Export replay bundle
☑ Re-run from a selected checkpoint
☑ Remove one event and prove replay verification fails
☑ Tamper one diff and prove digest mismatch
☑ Inject out-of-order event and prove replay rejects it
☑ Fork replay from an intermediate step and prove the new branch diverges cleanly

## Required proof artifact

☑ `docs/proof/SECTION_47_SKYE_REPLAY.json`

## Completion gate

☑ A real autonomous run can be rewound, inspected, verified, forked, and re-executed from a checkpoint
