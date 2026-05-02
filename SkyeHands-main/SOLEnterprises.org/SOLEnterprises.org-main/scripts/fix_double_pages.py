#!/usr/bin/env python3
import os

ROOT = os.path.dirname(os.path.dirname(__file__))
EXTS = ['.html', '.htm', '.js', '.css', '.json', '.md']
changed = []
for dp, dns, fns in os.walk(ROOT):
    if '.git' in dp or 'node_modules' in dp:
        continue
    for fn in fns:
        if any(fn.endswith(ext) for ext in EXTS):
            path = os.path.join(dp, fn)
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    s = f.read()
            except Exception:
                continue
            orig = s
            s = s.replace('/Pagespages/', '/Pages/')
            s = s.replace('/Pages/Pages/', '/Pages/')
            s = s.replace('/Pages/Pages/', '/Pages/')
            s = s.replace('/Pages/pages/', '/Pages/')
            s = s.replace('/PagesPages/', '/Pages/')
            # also fix occurrences without leading slash
            s = s.replace('Pagespages/', 'Pages/')
            if s != orig:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(s)
                changed.append(os.path.relpath(path, ROOT))
                print('Fixed', path)
print('\nDone. Fixed files:', len(changed))
for c in changed:
    print('-', c)
