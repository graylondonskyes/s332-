# SkyeQuantaCore-TheHybrid-AutonomousIDE

Canonical operator entrypoints for the shipped package now live at the root.

## Root entrypoints

- `./START_HERE.sh`
- `./skyequanta`
- `node ./skyequanta.mjs <command>`

## Common commands

- `./skyequanta operator:start --json`
- `./skyequanta doctor --mode deploy --probe-active --json`
- `./skyequanta workspace:proof:section61`
- `./skyequanta workspace:proof:section62`
- `./skyequanta workspace:proof:section63`
- `./skyequanta ship:candidate --strict --json`

## Shell package

The canonical runtime remains `apps/skyequanta-shell`.
This root layer exists so diligence reviewers and operators can enter through a converged shipped surface instead of guessing internal paths.
