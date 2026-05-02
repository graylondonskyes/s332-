# SECTION 46 — SKYE MEMORY FABRIC DIRECTIVE

## Goal

Turn SkyeHands into a persistent engineering memory system, not just an IDE or agent session.

## Required implementation

☑ Create a durable engineering memory graph store
☑ Add node classes for workspace, repo, file, symbol, issue, task, run, failure, fix, deployment, policy-decision, user-correction, dependency, test-case
☑ Add edge classes for touched, caused, fixed-by, related-to, blocked-by, approved-by, failed-under, reoccurred-in
☑ Ingest memory events from agent planning, file edits, command execution, test failures, deploys, policy denials, runtime repair, audit verification, and user overrides
☑ Add memory retrieval API for “similar prior failures,” “related corrections,” “files that move together,” and “accepted architecture rules”
☑ Add memory-aware context injection for future autonomous runs
☑ Add UI panel for memory timeline and related-context inspection
☑ Add explanation surface that cites memory-backed reasons for future decisions

## Required smoke proof

☑ Create a fixture task run
☑ Create a fixture failure
☑ Store a successful repair
☑ Store a human correction
☑ Restart the runtime and prove memory persistence
☑ Query the memory graph and prove a future autonomous decision changes because of stored prior context
☑ Inject duplicate events and prove dedupe behavior
☑ Inject contradictory correction and prove precedence rules
☑ Corrupt one graph edge and prove graph verification fails loudly

## Required proof artifact

☑ `docs/proof/SECTION_46_SKYE_MEMORY_FABRIC.json`

## Completion gate

☑ The system can truthfully show that a prior failure and correction materially changed a later autonomous decision
