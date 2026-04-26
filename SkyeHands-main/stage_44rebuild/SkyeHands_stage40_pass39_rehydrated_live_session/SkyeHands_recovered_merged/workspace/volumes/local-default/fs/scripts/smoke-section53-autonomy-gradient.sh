#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR/apps/skyequanta-shell"
npm run workspace:proof:section53 -- --strict >/tmp/section53-smoke.json
cat /tmp/section53-smoke.json
