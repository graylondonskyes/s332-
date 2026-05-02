#!/usr/bin/env bash
# SkyeDexia CLI wrapper
# Usage:
#   ./skydexia.sh status
#   ./skydexia.sh build-website "A SaaS landing page for an AI code reviewer"
#   ./skydexia.sh call design "Plan a dark luxury site for a fintech startup"
#   ./skydexia.sh call code "Generate hero section HTML" --provider openai
#   ./skydexia.sh start-worker            — start the HTTP worker on port 4120
#   ./skydexia.sh worker-health           — check if the worker is running

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ORCHESTRATOR="$SCRIPT_DIR/AbovetheSkye-Platforms/SkyDexia/skydexia-orchestrator.mjs"
WORKER="$SCRIPT_DIR/skyehands_runtime_control/core/webcreator/skydexia-webcreator-worker.mjs"

# Load .env if it exists alongside this script
if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR/.env"
  set +a
fi

WORKER_PORT="${SKYDEXIA_WORKER_PORT:-4120}"
WORKER_URL="${SKYDEXIA_WORKER_URL:-http://localhost:${WORKER_PORT}}"

case "$1" in
  start-worker)
    echo "[skydexia] Starting WebCreator worker on port ${WORKER_PORT}..."
    exec node "$WORKER"
    ;;
  worker-health)
    curl -s "${WORKER_URL}/health" | node -e "
      let d=''; process.stdin.on('data',c=>d+=c).on('end',()=>{
        try { const j=JSON.parse(d); console.log(j.ok ? '[skydexia] worker UP — uptime:'+j.uptime+'s' : '[skydexia] worker ERROR'); }
        catch { console.log('[skydexia] worker not reachable'); }
      });
    "
    ;;
  worker-build)
    shift
    BRIEF="$*"
    if [ -z "$BRIEF" ]; then echo "Usage: ./skydexia.sh worker-build \"site brief\""; exit 1; fi
    echo "[skydexia] Sending to worker: ${BRIEF:0:80}..."
    curl -s -X POST "${WORKER_URL}/build-website" \
      -H "Content-Type: application/json" \
      ${SKYDEXIA_WORKER_SECRET:+-H "x-worker-secret: $SKYDEXIA_WORKER_SECRET"} \
      -d "{\"brief\": $(node -e "process.stdout.write(JSON.stringify(process.argv[1]))" "$BRIEF"), \"name\": $(node -e "process.stdout.write(JSON.stringify(process.argv[1].slice(0,80)))" "$BRIEF")}" \
      | node -e "
        let d=''; process.stdin.on('data',c=>d+=c).on('end',()=>{
          try { const j=JSON.parse(d); console.log(JSON.stringify(j,null,2)); }
          catch { console.log(d); }
        });
      "
    ;;
  *)
    exec node "$ORCHESTRATOR" "$@"
    ;;
esac
