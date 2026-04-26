# SkyeQuantaCore System Dependency Manifest

## Canonical cold-machine bootstrap contract

The canonical cold-machine bootstrap path is the root command below:

```bash
npm run cold-machine:boot -- --smoke --json
```

That command materializes runtime state, verifies the canonical truth-path files, reruns the Stage 1 truth-path proof, starts the shell-owned bridge, and then probes deploy-mode doctor plus lifecycle smoke before writing a machine-readable bootstrap report.

## Runtime assumptions for the canonical boot flow

### Required host tools
- Node.js 22+
- npm
- bash
- curl (for shell smoke wrappers)

### Auto-managed runtime state
- `.skyequanta/` runtime state directory
- `.skyequanta/reports/` bootstrap report directory
- `.skyequanta/runtime.env` local operator secret store
- `workspace/` runtime workspace root

### Operator-mode defaults injected by canonical cold-machine bootstrap
- `SKYEQUANTA_ADMIN_TOKEN`
- `SKYEQUANTA_GATE_TOKEN`
- `SKYEQUANTA_GATE_URL`
- `SKYEQUANTA_GATE_MODEL`

These defaults are intentionally local-bootstrap values so deploy-mode doctor can prove the runtime contract from a fresh machine without requiring manual env babysitting during the bootstrap phase.

## Linux / devcontainer wrappers

### Linux
```bash
bash scripts/bootstrap-linux.sh --smoke --json
```

### Devcontainer
```bash
bash scripts/bootstrap-devcontainer.sh --smoke --json
```

Both wrappers call the same canonical Node bootstrap runner and only differ by profile-oriented environment defaults.

## Machine-readable report outputs
- `.skyequanta/reports/COLD_MACHINE_BOOTSTRAP_LATEST.json`
- `.skyequanta/reports/COLD_MACHINE_BOOTSTRAP_FAILURE.json`
- `docs/proof/SECTION_2_COLD_MACHINE_BOOTSTRAP.json` when smoke mode is used

## Current truth boundary

This manifest documents the canonical cold-machine bootstrap lane. The repo now ships a product-owned bundled fallback lane for Poetry, `xkbfile`, ripgrep, native-only IDE modules, and generated browser/backend artifacts, and the canonical doctor/bootstrap proofs exercise that lane directly.

## Product-owned repair lane

The repo now exposes a product-owned dependency recovery command:

```bash
npm run runtime:prepare
```

That command calls the same shell lane used by `npm run bootstrap` and `doctor --repair`. It is responsible for:
- publishing a bundled Poetry shim backed by `.skyequanta/runtime-deps/agent-venv`
- publishing a bundled `xkbfile.pc` lane under `.skyequanta/runtime-deps/pkgconfig`
- repairing the IDE ripgrep payload and fallback binary under `platform/ide-core/node_modules/@vscode/ripgrep/`
- installing JS fallback stubs for the native-only IDE modules (`keytar`, `drivelist`, `node-pty`)
- regenerating browser/backend artifacts when doctor-required outputs are missing
- auto-installing Linux system packages when `apt-get` + `sudo` are available and the operator wants full upstream native rebuilds

This still does **not** claim that every possible upstream Theia dependency failure is solved on every machine. It does claim that the canonical product lane no longer asks the operator to manually babysit Poetry, `xkbfile`, ripgrep, native bindings, or generated backend artifacts one by one.
