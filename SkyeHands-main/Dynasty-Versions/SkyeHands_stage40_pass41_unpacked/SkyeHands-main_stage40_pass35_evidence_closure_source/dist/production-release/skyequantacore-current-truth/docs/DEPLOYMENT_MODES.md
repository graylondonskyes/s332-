# SkyeQuantaCore deployment modes

## Canonical ship-candidate sequence

1. `./START_HERE.sh`

Equivalent explicit command:
1. `npm run operator:green:json`

The operator-green flow now runs cold-machine bootstrap, deploy doctor, gate/runtime sealing, redacted support-dump generation, and ship-candidate packaging in one canonical operator lane. When you explicitly request `--with-regression`, it also reruns the heavy Stage 11 regression smoke. The ship-candidate flow emits the operator handoff archive, the artifact manifest, the deployment readiness report, the public investor/procurement packet surfaces, the OPEN_ME_FIRST handoff surface, the redacted support dump, and the latest gate-runtime seal report.

## Non-expert operator mode

Use this mode when the person running the package needs the shortest possible path.

- Copy `config/env-templates/deploy.env.example` into `.env.local`
- Run `./START_HERE.sh`
- Deliver the generated `dist/ship-candidate/` outputs

The longer explanation for this flow lives in `docs/NONEXPERT_OPERATOR_QUICKSTART.md`.

## Local operator mode

Use this mode when the operator is running the shell directly on one workstation.

- Load `config/env-templates/dev.env.example` into `.env.local`
- Run `npm run cold-machine:boot -- --json`
- Run `npm run start`
- Verify `http://127.0.0.1:3020/api/status`

## Container mode

Use this mode when the operator is running from the included devcontainer or a compatible container host.

- Load `config/env-templates/deploy.env.example` or `proof.env.example`
- Run `bash scripts/bootstrap-devcontainer.sh --smoke --json`
- Run `node apps/skyequanta-shell/bin/runtime-seal.mjs --strict --json`
- Run `npm run ship:candidate -- --strict --json`
- Deliver the generated `dist/ship-candidate/` outputs

## Remote-host mode

Use this mode when the operator is staging the shell on a remote Linux host.

- Load `config/env-templates/deploy.env.example`
- Run `bash scripts/bootstrap-linux.sh --smoke --json`
- Run `node apps/skyequanta-shell/bin/doctor.mjs --mode deploy --probe-active --json`
- Run `node apps/skyequanta-shell/bin/runtime-seal.mjs --strict --json`
- Run `npm run ship:candidate -- --strict --json`

## Proof mode

Use this mode for regression, smoke, and evidence generation.

- Load `config/env-templates/proof.env.example`
- Run `node apps/skyequanta-shell/bin/runtime-seal.mjs --strict --json`
- Run `npm run workspace:proof:stage9 -- --strict`
- Run `npm run workspace:proof:section8 -- --strict`
