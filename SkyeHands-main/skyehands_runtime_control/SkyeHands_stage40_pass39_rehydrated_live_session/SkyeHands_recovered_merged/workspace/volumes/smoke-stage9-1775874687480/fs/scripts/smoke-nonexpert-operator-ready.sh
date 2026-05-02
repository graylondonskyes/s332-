#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
./skyequanta operator-green --json >/tmp/skyequanta-operator-green.json
node apps/skyequanta-shell/bin/workspace-proof-section12-nonexpert-operator-ready.mjs --strict