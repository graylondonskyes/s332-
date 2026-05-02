#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR/apps/skyequanta-shell"
node bin/workspace-proof-section47-skye-replay.mjs --strict >/tmp/section47-skye-replay.json
node bin/replay-verify.mjs --file "$ROOT_DIR/dist/section47/replay-proof/replay-bundle.json" --json >/tmp/section47-skye-replay-verify.json
node bin/replay-fork.mjs --file "$ROOT_DIR/dist/section47/replay-proof/replay-bundle.json" --order 6 --json >/tmp/section47-skye-replay-fork.json
cat /tmp/section47-skye-replay.json >/dev/null
cat /tmp/section47-skye-replay-verify.json >/dev/null
cat /tmp/section47-skye-replay-fork.json >/dev/null
