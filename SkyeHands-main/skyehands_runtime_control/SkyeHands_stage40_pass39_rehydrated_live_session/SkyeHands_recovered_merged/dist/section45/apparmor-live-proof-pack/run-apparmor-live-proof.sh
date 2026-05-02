#!/usr/bin/env bash
set -euo pipefail
PACK_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PACK_DIR"
node verify-apparmor-live-proof.mjs --execute
