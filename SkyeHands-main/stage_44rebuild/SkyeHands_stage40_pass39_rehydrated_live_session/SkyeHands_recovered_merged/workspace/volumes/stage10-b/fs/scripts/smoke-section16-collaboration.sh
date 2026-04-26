#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node apps/skyequanta-shell/bin/workspace-proof-section16-collaboration.mjs --strict >/tmp/section16-collaboration.json
cat /tmp/section16-collaboration.json
