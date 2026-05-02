#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

cleanup() {
  pkill -f "$ROOT_DIR/apps/skyequanta-shell/bin/bridge.mjs" >/dev/null 2>&1 || true
  pkill -f "$ROOT_DIR/apps/skyequanta-shell/bin/remote-executor.mjs" >/dev/null 2>&1 || true
  pkill -f "$ROOT_DIR/apps/skyequanta-shell/bin/workspace-service.mjs" >/dev/null 2>&1 || true
}

run_step() {
  cleanup
  echo "[stage11-smoke] $*"
  "$@"
  cleanup
}

run_step npm run workspace:proof:stage7 -- --strict
run_step npm run workspace:proof:stage1 -- --strict
run_step npm run workspace:proof:stage2 -- --strict
run_step npm run workspace:proof:stage2b -- --strict
run_step npm run workspace:proof:stage3 -- --strict
run_step npm run workspace:proof:stage4 -- --strict
run_step npm run workspace:proof:stage5 -- --strict
run_step npm run workspace:proof:stage6 -- --strict
run_step env SKYEQUANTA_SKIP_STAGE7_PREREQ=1 npm run workspace:proof:stage8 -- --strict
run_step env SKYEQUANTA_SKIP_STAGE8_PREREQ=1 npm run workspace:proof:stage9 -- --strict
run_step env SKYEQUANTA_SKIP_STAGE4_PREREQ=1 npm run workspace:proof:stage10 -- --strict
run_step node apps/skyequanta-shell/bin/workspace-proof-stage11.mjs --strict --fresh-window-minutes 60
