#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
python3 -m py_compile tools/scan_zip.py tools/patch_zip.py tools/repair_brain.py tools/trust_chain.py scripts/directproof_e2e.py
node --check server/server.mjs
node --check public/app.js
python3 - <<'PY' "$ROOT"
from pathlib import Path
import json, sys
root = Path(sys.argv[1])
summary = json.loads((root / 'proof-pack' / 'SUMMARY.json').read_text())
assert summary['proofMode'] == 'e2e-http-and-directproof-bundled'
assert summary['nodeCompletionPercent'] >= 100.0
assert summary['polyCompletionPercent'] >= 100.0
assert summary['nodeTrustVerified'] is True
assert summary['polyTrustVerified'] is True
assert summary['polyPackageManagerCount'] >= 4
assert summary['apiProof']['health'] is True
assert summary['apiProof']['repairEndpoint'] is True
assert summary['apiProof']['trustEndpoint'] is True
assert summary['apiProof']['portfolio'] is True
assert summary['apiProof']['authorityVerify'] is True
print(json.dumps(summary, indent=2))
PY
