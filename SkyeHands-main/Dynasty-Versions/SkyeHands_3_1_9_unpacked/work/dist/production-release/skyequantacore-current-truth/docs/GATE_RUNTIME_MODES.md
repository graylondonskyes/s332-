# Gate Runtime Modes

## Canonical source of truth
The canonical gate/runtime source of truth is `config/gate-runtime.json`, with secret values injected through the environment variables listed in that file. Runtime mode can be overridden explicitly with `SKYEQUANTA_RUNTIME_MODE`.

## Supported modes
- `offline` — gate routes are unavailable by design. The bridge hard-fails any `/api/gate/*` proxy request and reports the runtime as offline.
- `local-only` — shell and local workspace flows remain active, but gate-backed AI proxy routes are disabled.
- `remote-gated` — gate URL and gate token are required. Bridge and launch startup hard-fail if those values are missing.

## Required remote-gated configuration
- `SKYEQUANTA_RUNTIME_MODE=remote-gated`
- `SKYEQUANTA_GATE_URL` or `OMEGA_GATE_URL`
- `SKYEQUANTA_GATE_TOKEN` or `SKYEQUANTA_OSKEY`
- optional `SKYEQUANTA_GATE_MODEL`

## Redaction policy
Secret redaction rules are defined in `config/redaction-policy.json`. The same redaction helper is used for admin config views, proof artifacts, generated support dumps, and the runtime seal report.

## Admin verification route
`GET /api/gate/config`

Requires the bridge admin token and returns the active gate runtime mode, source metadata, validation state, and redaction policy metadata without exposing raw secret values.

## Runtime seal command
`node apps/skyequanta-shell/bin/runtime-seal.mjs --strict --json`

This command verifies the active mode, confirms the required docs and env templates are present, emits a redacted support dump, and writes the latest machine-readable seal report to `.skyequanta/reports/GATE_RUNTIME_SEAL_LATEST.json`.

## Packaging note
The canonical ship-candidate flow now runs the runtime seal automatically so the handoff package contains the latest gate/runtime seal state along with the deploy report and public dossier files.
