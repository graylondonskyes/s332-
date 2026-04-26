from __future__ import annotations

from datetime import datetime
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app import db  # noqa: E402


def main() -> None:
    db.init_db()
    stamp = datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
    target = ROOT / 'backups' / f'appointments-backup-{stamp}.sqlite3'
    path = db.create_sqlite_backup(target)
    print(path)


if __name__ == '__main__':
    main()
