#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR/apps/skyequanta-shell"
node bin/workspace-proof-section45-apparmor-delegated.mjs --strict
