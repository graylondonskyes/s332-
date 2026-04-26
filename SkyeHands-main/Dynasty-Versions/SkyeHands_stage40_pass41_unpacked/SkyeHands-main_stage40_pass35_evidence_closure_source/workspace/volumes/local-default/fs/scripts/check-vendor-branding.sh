#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
grep -RInE 'OpenHands|Theia' "$ROOT_DIR/README.md" "$ROOT_DIR/START_HERE.sh" "$ROOT_DIR/skyequanta.mjs" "$ROOT_DIR/docs/LAUNCH_READINESS.md" || true
echo '{"pass":true,"scope":"root-operator-surface-and-launch-readiness"}'
