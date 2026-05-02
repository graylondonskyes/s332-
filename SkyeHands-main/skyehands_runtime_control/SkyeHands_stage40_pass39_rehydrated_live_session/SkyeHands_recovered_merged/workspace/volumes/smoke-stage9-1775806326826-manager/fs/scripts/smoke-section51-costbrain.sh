#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/apps/skyequanta-shell"
node bin/workspace-proof-section51-costbrain.mjs --json
