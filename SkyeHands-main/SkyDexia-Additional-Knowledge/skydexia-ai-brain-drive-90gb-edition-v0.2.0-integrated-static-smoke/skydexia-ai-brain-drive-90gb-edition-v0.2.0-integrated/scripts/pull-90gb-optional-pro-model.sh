#!/usr/bin/env bash
set -Eeuo pipefail
if ! command -v ollama >/dev/null 2>&1; then echo "Ollama is not installed."; exit 1; fi
if [ "${OLLAMA_MODELS:-}" = "" ]; then echo "OLLAMA_MODELS is not set. Run: source .env.skydexia"; exit 1; fi
AVAILABLE_KB="$(df -k "${SKYDEXIA_DRIVE:-$OLLAMA_MODELS}" | awk 'NR==2 {print $4}')"
AVAILABLE_GB=$(( AVAILABLE_KB / 1024 / 1024 ))
if [ "$AVAILABLE_GB" -lt 35 ]; then
  echo "Not enough safe free space for optional Pro model. Available: ${AVAILABLE_GB}GB. Need at least 35GB free before pulling deepseek-coder-v2:lite."
  exit 1
fi
ollama pull deepseek-coder-v2:lite
bash scripts/check-drive-space.sh
echo "Optional Pro model pull complete."
