#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
node apps/skyequanta-shell/bin/workspace-proof-section8-deployment-packaging.mjs --strict
