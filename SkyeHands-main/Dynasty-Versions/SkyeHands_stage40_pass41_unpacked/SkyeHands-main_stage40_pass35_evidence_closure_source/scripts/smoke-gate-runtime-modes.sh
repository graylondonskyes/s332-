#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
node apps/skyequanta-shell/bin/workspace-proof-section5-gate-runtime.mjs --strict >/tmp/skyequanta-section5-proof.json
cat /tmp/skyequanta-section5-proof.json
