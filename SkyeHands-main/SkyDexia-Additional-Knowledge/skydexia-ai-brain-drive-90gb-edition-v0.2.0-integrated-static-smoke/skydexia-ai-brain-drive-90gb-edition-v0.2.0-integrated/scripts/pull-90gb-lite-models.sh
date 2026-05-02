#!/usr/bin/env bash
set -Eeuo pipefail
if ! command -v ollama >/dev/null 2>&1; then echo "Ollama is not installed. Install: curl -fsSL https://ollama.com/install.sh | sh"; exit 1; fi
if [ "${OLLAMA_MODELS:-}" = "" ]; then echo "OLLAMA_MODELS is not set. Run: source .env.skydexia"; exit 1; fi
mkdir -p "$OLLAMA_MODELS"
bash scripts/check-drive-space.sh
echo "Pulling SkyeDexia 90GB Lite models into: $OLLAMA_MODELS"
ollama pull qwen2.5-coder:7b
bash scripts/check-drive-space.sh
ollama pull phi4-mini
bash scripts/check-drive-space.sh
ollama pull llama3.2:3b
bash scripts/check-drive-space.sh
echo "Lite model pull complete."
echo "Optional: bash scripts/pull-90gb-optional-pro-model.sh"
