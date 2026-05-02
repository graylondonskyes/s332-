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

mkdir -p "$SKYDEXIA_MODEL_ROOT/ollama"

echo "Starting SkyeDexia 90GB Docker GPU stack..."
echo "Model root: $SKYDEXIA_MODEL_ROOT"

docker compose --env-file .env.docker -f docker-compose.gpu.yml up --build -d

echo
echo "Running containers:"
docker ps --filter "name=skydexia90"
echo
echo "Open:"
echo "http://localhost:8787"
