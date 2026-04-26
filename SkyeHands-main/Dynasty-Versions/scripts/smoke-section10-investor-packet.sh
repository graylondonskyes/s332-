#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"
node apps/skyequanta-shell/bin/workspace-proof-section10-investor-packet.mjs --strict
