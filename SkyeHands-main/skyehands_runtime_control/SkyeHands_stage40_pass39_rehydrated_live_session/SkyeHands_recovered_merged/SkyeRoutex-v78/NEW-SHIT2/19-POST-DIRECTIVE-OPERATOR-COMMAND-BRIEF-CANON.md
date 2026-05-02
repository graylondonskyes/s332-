# 19 — POST-DIRECTIVE OPERATOR COMMAND BRIEF CANON

This file is phase-after material.
It does **not** replace the directive.
It exists only because the directive lane is already closed in code.

## Purpose
The operator command brief is the high-level daily/offline command snapshot for Routex and AE FLOW.
It packages the current Routex field state into one sync-ready artifact.

## Minimum brief payload
- route-pack count
- trip-pack count
- fresh / legacy / transfer / no-dead proof counts
- walkthrough receipt count
- completion binder count
- device attestation count
- hybrid queue / sync-outbox counts
- latest binder / receipt / proof fingerprints when present
- readiness score
- brief fingerprint

## Rule
This brief is for operator visibility and AE FLOW handoff.
It must remain honest.
It may summarize readiness, but it must not invent live smoke that did not happen.
