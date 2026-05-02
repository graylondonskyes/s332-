#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR/apps/skyequanta-shell"
node bin/workspace-proof-section49-proofops.mjs --strict >/tmp/section49-proofops.json
node bin/proofops-validate.mjs --json >/tmp/section49-proofops-validate.json
cat /tmp/section49-proofops.json >/dev/null
cat /tmp/section49-proofops-validate.json >/dev/null
