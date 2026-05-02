#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
export SKYEQUANTA_ADMIN_TOKEN="${SKYEQUANTA_ADMIN_TOKEN:-section6-admin-token}"
export SKYEQUANTA_BRIDGE_PORT="${SKYEQUANTA_BRIDGE_PORT:-4920}"
export SKYEQUANTA_REMOTE_EXECUTOR_PORT="${SKYEQUANTA_REMOTE_EXECUTOR_PORT:-4921}"
pkill -9 -f "$ROOT_DIR/apps/skyequanta-shell/bin/bridge.mjs" 2>/dev/null || true
pkill -9 -f "$ROOT_DIR/apps/skyequanta-shell/bin/remote-executor.mjs" 2>/dev/null || true
node apps/skyequanta-shell/bin/bridge.mjs >/tmp/skyequanta-section6-bridge.log 2>&1 &
BRIDGE_PID=$!
export SKYEQUANTA_SECTION6_BRIDGE_PID="$BRIDGE_PID"
cleanup() {
  kill -TERM "$BRIDGE_PID" 2>/dev/null || true
}
trap cleanup EXIT
for _ in $(seq 1 80); do
  if curl -fsS "http://127.0.0.1:${SKYEQUANTA_BRIDGE_PORT}/api/status" >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done
node apps/skyequanta-shell/bin/workspace-proof-section6-governance-restore.mjs --strict
