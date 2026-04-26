#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node apps/skyequanta-shell/bin/workspace-proof-section15-pr-loop.mjs --strict
