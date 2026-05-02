# RUNBOOK: App Integration Automation

Use the scaffold script to generate a first-pass integration dossier for any app that needs to be parented by `SkyeGateFS13`.

## Script

- `scripts/scaffold-app-into-skygate.mjs`

## Purpose

The script scans an app for:

- legacy auth endpoints
- token issue/list/revoke usage
- local auth/session indicators
- Netlify redirect lanes
- `SkyeGateFS13` env bridge usage

It then writes:

- a machine-readable JSON dossier
- a human-readable Markdown integration brief

## Usage

From the `SkyeGateFS13` project root:

```bash
node ./scripts/scaffold-app-into-skygate.mjs \
  --app-path /absolute/path/to/app \
  --app-id app-slug
```

Optional:

- `--out-dir /absolute/path/to/output-dir`
- `--gate-env-var SKYGATEFS13_ORIGIN`
- `--gate-project-path /absolute/path/to/SkyeGateFS13`

## Expected Migration Model

The script assumes the target app should follow this model:

- `SkyeGateFS13` owns primary identity and clearance
- app-local routes remain allowed as compatibility adapters
- app-local tables remain allowed for app-specific state
- login, token issuance, usage, and push activity should still roll up into the parent gate

## Output

Default output location:

- `docs/integration-dossiers/<app-id>.json`
- `docs/integration-dossiers/<app-id>.md`

These dossiers are intended to become working migration ledgers, not just one-time reports.
