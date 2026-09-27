#!/usr/bin/env python3
"""Add a content hash (?v=...) to every local CSS/JS reference in the HTML pages.

Browsers then fetch a changed stylesheet or script the moment a new version is
deployed, instead of showing a cached old copy. Run after editing any file in
assets/css or assets/js (or config.js):  python3 scripts/stamp-assets.py
"""
import hashlib
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
REF = re.compile(r'((?:href|src)=")(/?)((?:assets/(?:css|js)/[\w.-]+\.(?:css|js))|config\.js)(?:\?v=[\w]+)?(")')


def digest(rel):
    return hashlib.sha1((ROOT / rel).read_bytes()).hexdigest()[:10]


def main():
    # stylesheets imported from app.css first, so app.css's own hash covers them
    app = ROOT / 'assets/css/app.css'
    css = app.read_text(encoding='utf-8')
    css = re.sub(r"@import url\('fonts\.css(?:\?v=\w+)?'\);", f"@import url('fonts.css?v={digest('assets/css/fonts.css')}');", css)
    app.write_text(css, encoding='utf-8')

    changed = 0
    for page in sorted(ROOT.glob('*.html')):
        html = page.read_text(encoding='utf-8')
        new = REF.sub(lambda m: f'{m.group(1)}{m.group(2)}{m.group(3)}?v={digest(m.group(3))}{m.group(4)}', html)
        if new != html:
            page.write_text(new, encoding='utf-8')
            changed += 1
    print(f'stamped {changed} page(s)')


if __name__ == '__main__':
    main()
