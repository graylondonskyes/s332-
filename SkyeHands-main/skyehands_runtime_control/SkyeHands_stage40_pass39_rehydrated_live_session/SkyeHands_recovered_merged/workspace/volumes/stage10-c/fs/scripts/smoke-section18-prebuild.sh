#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node apps/skyequanta-shell/bin/workspace-proof-section18-prebuild.mjs --strict >/tmp/section18-prebuild.json
cat /tmp/section18-prebuild.json
