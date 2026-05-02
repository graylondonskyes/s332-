#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
chmod +x "$ROOT/bin/skydexia-memory.mjs"
npm link
printf 'SkyDexia Memory Fabric linked globally. Use: skydexia-memory\n'
