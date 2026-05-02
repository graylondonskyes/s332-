#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

JSON_OUT="$(node apps/skyequanta-shell/bin/runtime-seal.mjs --strict --json)"
printf '%s\n' "$JSON_OUT"

LATEST_REPORT_REL="$(printf '%s' "$JSON_OUT" | node -e 'let raw="";process.stdin.on("data",d=>raw+=d);process.stdin.on("end",()=>{const payload=JSON.parse(raw);process.stdout.write(payload.outputs.latestReport||"");});')"
if [[ -z "$LATEST_REPORT_REL" || ! -f "$ROOT_DIR/$LATEST_REPORT_REL" ]]; then
  echo "runtime seal smoke failed: latest report missing" >&2
  exit 1
fi

grep -q '"ok": true' "$ROOT_DIR/$LATEST_REPORT_REL"
