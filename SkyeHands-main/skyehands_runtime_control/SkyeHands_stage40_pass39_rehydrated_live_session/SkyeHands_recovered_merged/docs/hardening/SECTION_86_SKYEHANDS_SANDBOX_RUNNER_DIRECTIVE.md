# Section 86 — SkyeHands Sandbox Runner Directive

☑ Workspace-scoped command runner implemented.
☑ Command allowlist implemented.
☑ CWD escape denial implemented.
☑ Timeout kill-path implemented.
☑ Secret env stripping implemented.
☑ Output redaction implemented.
☑ Denied-command smoke implemented.
☑ Escape-denial smoke implemented.
☑ Timeout smoke implemented.
☑ Proof ledger output implemented.

## Required proof

☑ `node platform/user-platforms/skyehands-codex-real-platform/skyehands-sandbox-runner.mjs smoke`
☑ `docs/proof/SKYEHANDS_SANDBOX_RUNNER_PROOF.json`

## Honest boundary

This is a real process sandbox layer, not full container isolation. Container-grade isolation still requires rootless namespaces or container runtime integration on the host.
