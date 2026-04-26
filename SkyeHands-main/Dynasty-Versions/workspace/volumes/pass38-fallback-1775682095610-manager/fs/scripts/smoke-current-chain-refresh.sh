#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR/apps/skyequanta-shell"
RAW_FILE=/tmp/current-chain-refresh.raw
JSON_FILE=/tmp/current-chain-refresh.json
node bin/current-chain-refresh.mjs --apply-docs --workspace-id local-default --force-release-lock --lock-ttl-ms 1 --json > "$RAW_FILE"
sed -n '/^{/,$p' "$RAW_FILE" > "$JSON_FILE"
ROOT_DIR="$ROOT_DIR" python3 - <<'PY'
import json, os
from pathlib import Path
root = Path(os.environ['ROOT_DIR'])
payload = json.loads(Path('/tmp/current-chain-refresh.json').read_text())
assert payload['ok'] is True
assert payload['docsApplied'] is True
entries = {entry['key']: entry for entry in payload['entries']}
assert 'stage8' in entries and 'section63' in entries
assert Path(payload['docs']['launchReadinessPath']).exists()
assert Path(payload['docs']['smokeContractMatrixPath']).exists()
assert (root / 'docs/proof/CURRENT_CHAIN_REFRESH_PLAN.json').exists()
text = (root / 'docs/SMOKE_CONTRACT_MATRIX.md').read_text()
assert 'Stage 8 preview forwarding' in text
assert 'CHECKMARK' in text or 'BLANK' in text
print(json.dumps({'ok': True, 'proof': 'current-chain-refresh-plan', 'openRefreshCount': payload['summary']['openRefreshCount']}))
PY
