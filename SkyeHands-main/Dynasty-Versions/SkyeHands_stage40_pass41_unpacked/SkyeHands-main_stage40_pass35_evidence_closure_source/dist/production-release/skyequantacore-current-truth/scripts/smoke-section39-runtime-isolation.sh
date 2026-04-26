#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node apps/skyequanta-shell/bin/workspace-proof-section39-runtime-isolation.mjs --strict
