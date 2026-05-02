#!/usr/bin/env python3
"""
Scan repository for literal "/pages/" occurrences, excluding export/cache directories.
Print files that still contain the string.
"""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXCLUDE_DIRS = {"sole-site-export", "sole-website-export", ".firebase", "node_modules", "standalone-gate"}

results = []
for dirpath, dirnames, filenames in os.walk(ROOT):
    rel = os.path.relpath(dirpath, ROOT)
    parts = set(rel.split(os.sep)) if rel != '.' else set()
    if parts & EXCLUDE_DIRS:
        dirnames[:] = []
        continue
    for fn in filenames:
        fp = Path(dirpath) / fn
        try:
            s = fp.read_text(encoding='utf-8')
        except Exception:
            continue
        if '/pages/' in s:
            results.append(str(fp.relative_to(ROOT)))

if results:
    print('Files containing "/pages/" (outside excluded dirs):')
    for p in results:
        print(' -', p)
else:
    print('No occurrences of "/pages/" found outside excluded directories.')
