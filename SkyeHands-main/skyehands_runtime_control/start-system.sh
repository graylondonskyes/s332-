#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# SkyeHands Runtime Control — System Launcher
# Starts the SkyeDexia webcreator worker and reports full system status.
#
# Usage:
#   ./start-system.sh                 — start worker + show status
#   ./start-system.sh --health        — health check only (no start)
#   ./start-system.sh --stop          — stop the running worker
#   ./start-system.sh --restart       — stop then start
#
# Env vars (set before running):
#   ANTHROPIC_API_KEY    — enables Claude for design/quality steps
#   OPENAI_API_KEY       — enables OpenAI for code generation
#   GROQ_API_KEY         — enables Groq for polish (fast)
#   SKYDEXIA_WORKER_PORT — default 4120
#   SKYDEXIA_WORKER_SECRET — bearer token for auth (optional)
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKER_SCRIPT="$ROOT/core/webcreator/skydexia-webcreator-worker.mjs"
PID_FILE="$ROOT/.worker.pid"
LOG_FILE="$ROOT/.worker.log"
PORT="${SKYDEXIA_WORKER_PORT:-4120}"
WORKER_URL="http://127.0.0.1:${PORT}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

log()  { printf "${CYAN}[skye]${RESET} %s\n" "$*"; }
ok()   { printf "${GREEN}[  ok]${RESET} %s\n" "$*"; }
warn() { printf "${YELLOW}[warn]${RESET} %s\n" "$*"; }
fail() { printf "${RED}[fail]${RESET} %s\n" "$*"; }
head() { printf "\n${BOLD}%s${RESET}\n" "$*"; }

# ── Arg parsing ──────────────────────────────────────────────────────────────
MODE="start"
for arg in "$@"; do
  case "$arg" in
    --health) MODE="health" ;;
    --stop)   MODE="stop" ;;
    --restart) MODE="restart" ;;
  esac
done

# ── Health check function ────────────────────────────────────────────────────
check_health() {
  local result
  if result=$(curl -sf --max-time 5 "$WORKER_URL/health" 2>/dev/null); then
    ok "Worker alive on port $PORT"
    echo "   $(echo "$result" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(f"uptime: {d.get(\"uptime\",\"?\")}s | version: {d.get(\"version\",\"?\")}")' 2>/dev/null || echo "$result")"
    return 0
  else
    return 1
  fi
}

check_status() {
  local result
  if result=$(curl -sf --max-time 5 "$WORKER_URL/status" 2>/dev/null); then
    echo "$result" | python3 -c '
import sys, json
d = json.load(sys.stdin)
mode = d.get("mode", "unknown")
avail = d.get("availableProviders", [])
total = d.get("totalProjects", 0)
print(f"   mode: {mode}")
print(f"   providers: {", ".join(avail) if avail else "none (template-only mode)"}")
print(f"   projects built: {total}")
' 2>/dev/null || true
  fi
}

show_provider_status() {
  head "API Key Status"
  local has_key=0
  for var in ANTHROPIC_API_KEY OPENAI_API_KEY GROQ_API_KEY DEEPSEEK_API_KEY OPENROUTER_API_KEY MISTRAL_API_KEY PERPLEXITY_API_KEY; do
    if [ -n "${!var:-}" ]; then
      ok "$var ✓"
      has_key=1
    else
      warn "$var — not set"
    fi
  done
  if [ "$has_key" -eq 0 ]; then
    warn "No API keys set — SkyeDexia will run in template-only mode"
    warn "Template mode produces real pages without AI calls."
  fi
  echo ""
}

# ── Stop ─────────────────────────────────────────────────────────────────────
stop_worker() {
  if [ -f "$PID_FILE" ]; then
    local pid
    pid=$(cat "$PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      log "Stopping worker PID $pid..."
      kill "$pid" 2>/dev/null || true
      sleep 1
      ok "Worker stopped"
    else
      warn "PID $pid not running (stale pid file)"
    fi
    rm -f "$PID_FILE"
  else
    warn "No PID file — worker may not be running via this script"
    # Try to find it anyway
    local pid
    pid=$(lsof -ti tcp:"$PORT" 2>/dev/null || true)
    if [ -n "$pid" ]; then
      log "Found process on port $PORT (PID: $pid), stopping..."
      kill "$pid" 2>/dev/null || true
      ok "Stopped PID $pid"
    fi
  fi
}

# ── Start ────────────────────────────────────────────────────────────────────
start_worker() {
  if check_health 2>/dev/null; then
    ok "Worker already running on port $PORT"
    check_status
    return 0
  fi

  log "Starting SkyeDexia worker on port $PORT..."
  nohup node "$WORKER_SCRIPT" >> "$LOG_FILE" 2>&1 &
  local pid=$!
  echo "$pid" > "$PID_FILE"
  log "Worker PID: $pid | log: $LOG_FILE"

  # Wait for it to come up
  local attempts=0
  while [ $attempts -lt 15 ]; do
    sleep 0.5
    if check_health 2>/dev/null; then
      check_status
      return 0
    fi
    attempts=$((attempts + 1))
  done

  fail "Worker did not start in 7.5s — check $LOG_FILE"
  tail -20 "$LOG_FILE" 2>/dev/null || true
  return 1
}

# ── Main ─────────────────────────────────────────────────────────────────────
printf "\n${BOLD}SkyeHands Runtime Control${RESET} — System Launcher\n"
printf "Worker: ${CYAN}%s${RESET}\n" "$WORKER_SCRIPT"
echo ""

case "$MODE" in
  health)
    show_provider_status
    head "Worker Health"
    if check_health; then
      check_status
    else
      fail "Worker not responding on port $PORT"
      exit 1
    fi
    ;;
  stop)
    stop_worker
    ;;
  restart)
    stop_worker
    sleep 1
    show_provider_status
    start_worker
    ;;
  start)
    show_provider_status
    head "Starting Worker"
    start_worker
    ;;
esac

echo ""
log "Run './start-system.sh --health' to check status at any time"
log "Worker logs: $LOG_FILE"
