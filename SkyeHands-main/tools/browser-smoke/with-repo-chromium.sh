#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-$ROOT_DIR/.ms-playwright}"

node "$ROOT_DIR/tools/browser-smoke/verify-browser-smoke-env.mjs" >/dev/null
exec "$@"
