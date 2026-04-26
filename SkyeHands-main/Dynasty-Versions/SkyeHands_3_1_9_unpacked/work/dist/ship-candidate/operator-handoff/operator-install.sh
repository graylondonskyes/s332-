#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
echo "[SkyeQuantaCore] START_HERE -> canonical operator CLI"
./skyequanta operator-green --json
