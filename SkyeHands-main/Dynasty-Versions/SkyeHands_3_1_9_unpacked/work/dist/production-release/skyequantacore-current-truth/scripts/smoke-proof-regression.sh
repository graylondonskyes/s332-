#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

cleanup() {
  pkill -f "$ROOT_DIR/apps/skyequanta-shell/bin/bridge.mjs" >/dev/null 2>&1 || true
  pkill -f "$ROOT_DIR/apps/skyequanta-shell/bin/remote-executor.mjs" >/dev/null 2>&1 || true
  pkill -f "$ROOT_DIR/apps/skyequanta-shell/bin/workspace-service.mjs" >/dev/null 2>&1 || true
}

run_proof() {
  local script_path="$1"
  local artifact_path="$2"
  shift 2
  cleanup
  echo "[stage11-smoke] ${script_path} ${artifact_path} $*"
  node apps/skyequanta-shell/bin/run-proof-with-artifact-timeout.mjs \
    --script "$script_path" \
    --artifact "$artifact_path" \
    --strict \
    -- "$@"
  cleanup
}

run_proof apps/skyequanta-shell/bin/workspace-proof-stage4.mjs docs/proof/STAGE_4_REMOTE_EXECUTOR.json
SKYEQUANTA_SKIP_STAGE7_PREREQ=1 run_proof apps/skyequanta-shell/bin/workspace-proof-stage8.mjs docs/proof/STAGE_8_PREVIEW_FORWARDING.json
SKYEQUANTA_SKIP_STAGE8_PREREQ=1 run_proof apps/skyequanta-shell/bin/workspace-proof-stage9.mjs docs/proof/STAGE_9_DEPLOYMENT_READINESS.json
SKYEQUANTA_SKIP_STAGE4_PREREQ=1 run_proof apps/skyequanta-shell/bin/workspace-proof-stage10.mjs docs/proof/STAGE_10_MULTI_WORKSPACE_STRESS.json
run_proof apps/skyequanta-shell/bin/workspace-proof-stage11.mjs docs/proof/STAGE_11_REGRESSION_PROOF.json --fresh-window-minutes 120
