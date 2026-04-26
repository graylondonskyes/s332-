#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
node apps/skyequanta-shell/bin/workspace-proof-section19-governance.mjs --strict >/dev/null
