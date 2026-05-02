#!/usr/bin/env bash
set -Eeuo pipefail

if [ ! -f ".env.docker" ]; then
  echo "Missing .env.docker"
  echo "Run: cp .env.docker.example .env.docker"
  echo "Then edit SKYDEXIA_MODEL_ROOT."
  exit 1
fi

set -a
source .env.docker
set +a

if [ -z "${SKYDEXIA_MODEL_ROOT:-}" ]; then
  echo "SKYDEXIA_MODEL_ROOT is empty."
  exit 1
fi

mkdir -p "$SKYDEXIA_MODEL_ROOT/ollama"

echo "Starting SkyeDexia 90GB Docker stack..."
echo "Model root: $SKYDEXIA_MODEL_ROOT"

docker compose --env-file .env.docker up --build -d

echo
echo "Running containers:"
docker ps --filter "name=skydexia90"
echo
echo "Open:"
echo "http://localhost:8787"
echo
echo "Pull Lite models:"
echo "docker exec -it skydexia90-ollama ollama pull qwen2.5-coder:7b"
echo "docker exec -it skydexia90-ollama ollama pull phi4-mini"
echo "docker exec -it skydexia90-ollama ollama pull llama3.2:3b"
