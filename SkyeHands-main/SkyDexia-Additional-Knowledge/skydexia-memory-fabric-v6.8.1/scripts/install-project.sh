#!/usr/bin/env bash
set -Eeuo pipefail
PROJECT_DIR="${1:-$PWD}"
PROJECT_ID="${2:-$(basename "$PROJECT_DIR")}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$PROJECT_DIR/.skydexia-memory/exports"
cat > "$PROJECT_DIR/.skydexia-memory/config.json" <<JSON
{
  "version": "6.8.1",
  "projectId": "$PROJECT_ID",
  "corePath": "$ROOT",
  "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
JSON
cat > "$PROJECT_DIR/skydexia-memory.local.sh" <<SH
#!/usr/bin/env bash
node "$ROOT/bin/skydexia-memory.mjs" "\$@"
SH
chmod +x "$PROJECT_DIR/skydexia-memory.local.sh"
printf 'Installed local launcher: %s/skydexia-memory.local.sh\n' "$PROJECT_DIR"
