#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
node apps/skyequanta-shell/bin/workspace-proof-section26-operator-start.mjs --strict >/tmp/skyehands-section26-proof.json
cat /tmp/skyehands-section26-proof.json >/dev/null
