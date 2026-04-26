#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR/apps/skyequanta-shell"
node bin/workspace-proof-section63-agent-core-bundle.mjs --json
