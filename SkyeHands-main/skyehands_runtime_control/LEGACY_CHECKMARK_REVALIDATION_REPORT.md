# LEGACY CHECKMARK REVALIDATION REPORT

_Generated per directive section 1.1 — Proof Discipline_
_As-of: 2026-04-26_

## Purpose

Every prior directive checkmark that was granted from file existence, route existence,
JSON-key checks, or documentation-only proof is quarantined here until behavioral smoke
replaces it. A checkmark is only reinstated when:

1. The related code file exists and is non-trivial (not a stub/placeholder)
2. A behavioral smoke runs the actual code path and asserts a real state transition,
   provider call, database write, file mutation, or UI action
3. The smoke is classified BEHAVIORAL (not STRUCTURAL)

---

## Quarantined Legacy Claims

| Claim | Original Proof Type | Downgrade Reason | Required New Smoke |
|-------|---------------------|------------------|--------------------|
| AE Command Hub functional | File existence (package.json, functions dir) | STRUCTURAL — route files exist but no persistence or real provider dispatch proven | Login → client create → brain message → task create → state update → audit |
| Theia IDE runtime parity | Package.json key `@theia/monorepo` exists | STRUCTURAL — source present but `resolvedTheiaCli: null`, no build, no launch | CLI resolve → backend launch → browser launch → workspace open → file save → smoke trigger |
| OpenHands runtime | `platform/agent-core/pyproject.toml` + `server.mjs` | STRUCTURAL + boundary shim only | Python import → server start → task receipt → file edit → command run → result to SkyeHands |
| Printful Commerce Brain | Dry-run returning `success: true` | FALSE-SUCCESS — dry-run did not pass through real Printful service function | Product sync → draft order → webhook ingest → storefront update → audit |
| AI Appointment Setter | HTML form + static JS | HTML-ONLY — no OAuth, no calendar API, no booking backend | OAuth connect → availability query → booking create → reminder → AE handoff |
| 13 AE Brains independent | Roster JSON entries | STRUCTURAL — persona entries only, no per-brain state/queue/memory/usage | Each brain: task in → response out → state write → usage log |
| SkyeHands Platform Bus | No implementation found | MISSING — bus does not exist yet | Event emit → subscriber receives → audit ledger write → replay protection |
| GrayChunks Production-Ready | scan.mjs file exists | STRUCTURAL — basic file-count scanner only | Fixture false-claim detection → grade emission → CI gate block |

---

## Reinstatement Criteria

A quarantined claim is reinstated (marked ✅) only when:

- `CLAIMS_TO_SMOKE_MAP.json` shows `passing: true` for the claim
- `CODE_READINESS_MATRIX.json` shows `behavioralSmoke > 0` for the platform
- The proof bundle exists at `docs/proof-bundles/<platform>/`
- No outstanding `DOC-MISMATCH`, `FALSE-SUCCESS`, or `NO-BACKEND` violations exist

---

## Completion Percentage Rule

The completion percentage shown in any dashboard or docs is calculated as:

```
(reinstated behavioral claims) / (total claims) × 100
```

Quarantined structural-only claims are EXCLUDED from the numerator. They count
against the denominator until behavioral smoke replaces them.
