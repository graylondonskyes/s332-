#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR/apps/skyequanta-shell"
node bin/current-chain-refresh.mjs --apply-docs --workspace-id local-default --force-release-lock --lock-ttl-ms 1 --json > /tmp/current-chain-refresh.json
python3 - <<'PY'
import json
from pathlib import Path
payload = json.loads(Path('/tmp/current-chain-refresh.json').read_text())
assert payload['ok'] is True
assert payload['docsApplied'] is True
entries = {entry['key']: entry for entry in payload['entries']}
assert 'stage8' in entries and 'section63' in entries
assert Path(payload['docs']['launchReadinessPath']).exists()
assert Path(payload['docs']['smokeContractMatrixPath']).exists()
assert Path('docs/proof/CURRENT_CHAIN_REFRESH_PLAN.json').exists()
text = Path('docs/SMOKE_CONTRACT_MATRIX.md').read_text()
assert 'Stage 8 preview forwarding' in text
assert 'CHECKMARK' in text or 'BLANK' in text
print(json.dumps({'ok': True, 'proof': 'current-chain-refresh-plan', 'openRefreshCount': payload['summary']['openRefreshCount']}))
PY
