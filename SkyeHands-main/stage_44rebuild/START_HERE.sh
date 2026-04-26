#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"
printf 'SkyeQuanta root operator surface\n'
printf 'Try: ./skyequanta doctor --mode deploy --probe-active --json\n'
printf 'Or:  ./skyequanta operator:start --json\n'
exec ./skyequanta doctor --mode deploy --probe-active --json
