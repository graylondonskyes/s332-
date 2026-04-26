#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR/apps/skyequanta-shell"
npm run workspace:proof:section50 -- --strict >/tmp/section50-smoke.json
cat /tmp/section50-smoke.json
