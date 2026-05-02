#!/usr/bin/env bash
set -Eeuo pipefail

if [ -f ".env.docker" ]; then
  docker compose --env-file .env.docker down || true
  docker compose --env-file .env.docker -f docker-compose.gpu.yml down || true
else
  docker compose down || true
  docker compose -f docker-compose.gpu.yml down || true
fi

echo "SkyeDexia Docker stack stopped."
