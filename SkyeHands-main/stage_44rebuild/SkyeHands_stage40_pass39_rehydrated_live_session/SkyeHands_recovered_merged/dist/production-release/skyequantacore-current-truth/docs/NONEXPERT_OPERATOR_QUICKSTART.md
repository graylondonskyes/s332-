# Non-Expert Operator Quickstart

Use this guide when the person deploying or checking the package is not expected to know the internals.

## 1. Put the runtime values in place

- Copy `config/env-templates/deploy.env.example` into `.env.local`.
- Set the admin token.
- If you are using remote-gated mode, set the gate URL and gate token.

## 2. Run the one-command operator path

```bash
./START_HERE.sh
```

Equivalent explicit command:

```bash
./skyequanta operator-green --json
```

This single path prepares the machine, validates deploy readiness, emits the gate/runtime seal, emits a redacted operator support dump, and builds the ship-candidate package.

Optional heavy proof refresh when you want it:

```bash
./skyequanta operator-green --with-regression --json
```

## 3. Start the product surface

```bash
./skyequanta start
```

## 4. Check readiness directly when needed

```bash
./skyequanta doctor --mode deploy --probe-active --json
```

## 5. What to hand off

The main delivery outputs land in `dist/ship-candidate/`.

- `operator-handoff/` is the expanded handoff directory.
- `*.tar.gz` is the packaged handoff archive.
- `ARTIFACT_MANIFEST.json` carries hashes for the emitted outputs.
- `OPEN_ME_FIRST.html` is the non-expert handoff surface.
- `.skyequanta/reports/support-dumps/*.json` contains the redacted operator-safe support dump.

## Hard stop rules

- Do not bypass `./START_HERE.sh` or `./skyequanta operator-green --json` with raw internal bin paths unless you are debugging.
- Do not call the gate sealed if the operator-green lane reports a seal failure.
- Do not hand off the package if the operator-green lane is red.


## Workspace quick paths

Create a workspace from a Git repository:

```bash
npm run workspace:create:git -- my-workspace --repo https://github.com/example/repo.git --branch main --start
```

Create a workspace from a local template path:

```bash
npm run workspace:create:template -- my-template-workspace --template-path ./templates/base --start
```

Resume an existing workspace:

```bash
npm run workspace:resume -- my-workspace
```
