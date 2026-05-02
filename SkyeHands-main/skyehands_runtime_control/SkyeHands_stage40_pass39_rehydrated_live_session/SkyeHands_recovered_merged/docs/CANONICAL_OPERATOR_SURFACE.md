# Canonical Operator Surface

This file is the short, operator-facing command map.

## Use these commands

- `./START_HERE.sh`
- `./skyequanta operator-green --json`
- `./skyequanta start`
- `./skyequanta doctor --mode deploy --probe-active --json`
- `./skyequanta runtime-seal --strict --json`
- `./skyequanta support-dump --json`

## Do not lead with these in operator-facing docs

These still exist for compatibility or internal maintenance, but they are not the public product surface:

- raw `apps/skyequanta-shell/bin/*.mjs` paths
- `workspace-service.mjs`
- `real-ide-runtime.mjs`
- `workspace-proof.mjs`
- deep internal repair/build commands unless the operator is doing maintenance

## Compatibility note

Root npm commands still work, but they now route through the canonical operator CLI so the public surface stays converged.
