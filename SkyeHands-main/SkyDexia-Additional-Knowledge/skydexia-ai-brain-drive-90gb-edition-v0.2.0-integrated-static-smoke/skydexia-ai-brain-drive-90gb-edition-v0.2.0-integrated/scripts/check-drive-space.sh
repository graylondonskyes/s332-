#!/usr/bin/env bash
set -Eeuo pipefail
TARGET="${SKYDEXIA_DRIVE:-${1:-.}}"
echo "SkyeDexia 90GB Drive Space Check"
echo "Target: $TARGET"
echo
df -h "$TARGET"
AVAILABLE_KB="$(df -k "$TARGET" | awk 'NR==2 {print $4}')"
AVAILABLE_GB=$(( AVAILABLE_KB / 1024 / 1024 ))
echo
echo "Available approximate GB: ${AVAILABLE_GB}GB"
if [ "$AVAILABLE_GB" -lt 15 ]; then
  echo "FAIL: Less than 15GB free. Do not pull more models."
  exit 1
fi
if [ "$AVAILABLE_GB" -lt 30 ]; then
  echo "WARN: Low free space. Stay Lite only."
  exit 0
fi
echo "OK: Space is acceptable for 90GB Edition operations."
