from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

import sys
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app import db  # noqa: E402


def main() -> None:
    db.init_db()
    db.clear_runtime_data()
    for pycache in ROOT.rglob('__pycache__'):
        shutil.rmtree(pycache, ignore_errors=True)
    for pyc in ROOT.rglob('*.pyc'):
        try:
            pyc.unlink()
        except FileNotFoundError:
            pass
    print('Release bundle cleaned. Audit logs and runtime records cleared.')


if __name__ == '__main__':
    main()
