# Section 84 Platform Core

This pass adds the platform pieces that were missing from the earlier wrapper/foundation lane.

Implemented code paths:

- org state
- password-hashed users
- sessions
- RBAC
- project records
- task records
- approval gates
- usage metering
- audit ledger
- evidence export

Run:

```bash
node platform/user-platforms/skyehands-codex-real-platform/skyehands-platform-core.mjs smoke
```
