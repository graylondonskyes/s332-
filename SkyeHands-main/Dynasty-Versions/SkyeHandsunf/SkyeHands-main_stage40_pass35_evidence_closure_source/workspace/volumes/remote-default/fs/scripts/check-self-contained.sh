#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
required=(
  "$ROOT_DIR/README.md"
  "$ROOT_DIR/START_HERE.sh"
  "$ROOT_DIR/skyequanta"
  "$ROOT_DIR/skyequanta.mjs"
  "$ROOT_DIR/package.json"
  "$ROOT_DIR/Makefile"
  "$ROOT_DIR/apps/skyequanta-shell"
)
missing=0
for path in "${required[@]}"; do
  if [[ ! -e "$path" ]]; then
    echo "missing:$path"
    missing=1
  fi
done
if [[ $missing -ne 0 ]]; then
  exit 1
fi
echo '{"pass":true,"requiredEntrypoints":6}'
