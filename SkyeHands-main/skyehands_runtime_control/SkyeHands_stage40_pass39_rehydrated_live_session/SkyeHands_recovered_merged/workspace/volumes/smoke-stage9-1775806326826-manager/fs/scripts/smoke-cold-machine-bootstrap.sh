#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
node apps/skyequanta-shell/bin/cold-machine-bootstrap.mjs --smoke --json >/tmp/skyequanta-cold-machine-bootstrap.log
python - <<'PY'
import json, pathlib
report = pathlib.Path('.skyequanta/reports/COLD_MACHINE_BOOTSTRAP_LATEST.json')
artifact = pathlib.Path('docs/proof/SECTION_2_COLD_MACHINE_BOOTSTRAP.json')
assert report.exists(), report
payload = json.loads(report.read_text())
assert payload.get('ok') is True, payload
assert artifact.exists(), artifact
print(json.dumps({"ok": True, "report": str(report), "artifact": str(artifact)}, indent=2))
PY
