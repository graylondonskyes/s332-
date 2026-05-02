#!/usr/bin/env bash
set -Eeuo pipefail
if [ "${1:-}" = "" ]; then
  echo "Usage: bash scripts/setup-90gb-drive.sh /path/to/external/drive"
  echo "Example: bash scripts/setup-90gb-drive.sh /mnt/chromeos/removable/SKYEDEXIA90"
  exit 1
fi
DRIVE="$1"
MODEL_ROOT="$DRIVE/SkyeDexia90GB/SkyeAIModels"
WORKSPACE_ROOT="$DRIVE/SkyeDexia90GB/Workspace"
mkdir -p "$MODEL_ROOT/ollama" "$MODEL_ROOT/gguf" "$MODEL_ROOT/huggingface" "$MODEL_ROOT/adapters" "$MODEL_ROOT/manifests"
mkdir -p "$WORKSPACE_ROOT/memory" "$WORKSPACE_ROOT/docs" "$WORKSPACE_ROOT/exports" "$WORKSPACE_ROOT/proof"
cat > .env.skydexia <<EOF
export SKYDEXIA_EDITION="90GB"
export SKYDEXIA_DRIVE="$DRIVE"
export SKYDEXIA_MODEL_ROOT="$MODEL_ROOT"
export SKYDEXIA_WORKSPACE_ROOT="$WORKSPACE_ROOT"
export OLLAMA_MODELS="$MODEL_ROOT/ollama"
export SKYDEXIA_DEFAULT_MODEL="qwen2.5-coder:7b"
EOF
echo "SkyeDexia 90GB drive layout created."
echo "Drive: $DRIVE"
echo "Model root: $MODEL_ROOT"
echo "Workspace root: $WORKSPACE_ROOT"
echo
echo "Run:"
echo "source .env.skydexia"
echo "bash scripts/check-drive-space.sh"
echo "bash scripts/pull-90gb-lite-models.sh"
