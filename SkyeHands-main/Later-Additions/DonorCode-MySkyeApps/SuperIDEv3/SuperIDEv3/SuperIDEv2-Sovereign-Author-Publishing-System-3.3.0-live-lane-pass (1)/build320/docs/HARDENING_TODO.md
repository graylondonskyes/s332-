# HARDENING TODO

- [x] P0: Close unauthenticated workspace boot by requiring local operator session before workspace panels render.
- [x] P0: Enforce same-run browser smoke artifacts with screenshot plus DOM dump written during the same release pass.
- [x] P0: Gate release on fresh browser smoke evidence rather than stale snapshot naming.
- [x] P0: Enforce export/import passphrase integrity with tamper rejection.
- [x] P0: Keep gateway mode closed and provider-agnostic in canonical release files.

## Follow-on backlog

- [ ] P1: Add additional viewport matrices for tablet and mobile smoke.
- [ ] P1: Add diff-aware workspace regression snapshots for exported bundle comparisons.
