"""Rebuild the Japanese font subsets in public/fonts.

Sources (OFL): M PLUS 1p TTFs from github.com/google/fonts/tree/main/ofl/mplus1p,
Corporate Logo Bold ver3 OTF from logotype.jp/corporate-logo-font-dl.html.
Usage: python3 scripts/assets/subset-fonts.py <MPLUS1p dir> <Corporate-Logo-Bold-ver3.otf>
Rerun when a new identity title uses a kanji outside JIS level 1 (lib/data/identity-card-titles.json).
Needs: pip install fonttools brotli
"""
import json, sys
from fontTools import subset

mplus_dir, corp_otf = sys.argv[1], sys.argv[2]
BASE = [(0x20, 0x7E), (0xA0, 0xFF), (0x2000, 0x206F), (0x3000, 0x30FF), (0xFF00, 0xFFEF)]


def jis(rows):  # JIS X 0208 via two-byte EUC-JP
    out = set()
    for a in rows:
        for b in range(0xA1, 0xFF):
            try: out.add(bytes([a, b]).decode('euc_jp'))
            except UnicodeDecodeError: pass
    return out


def run(src, out, chars):
    text = ''.join(sorted(chars | {chr(c) for s, e in BASE for c in range(s, e + 1)}))
    subset.main([src, '--text=' + text, '--flavor=woff2', '--layout-features=*', '--output-file=public/fonts/' + out])


body = jis(range(0xA1, 0xFF)) | {chr(c) for s, e in [(0x2190, 0x21FF), (0x2460, 0x24FF), (0x2500, 0x257F), (0x25A0, 0x26FF)] for c in range(s, e + 1)}
for weight in ('Regular', 'Bold'):
    run(f'{mplus_dir}/MPLUS1p-{weight}.ttf', f'MPLUS1p-{weight}.woff2', body)

titles = json.load(open('lib/data/identity-card-titles.json'))
run(corp_otf, 'CorporateLogo-Bold.woff2', jis(range(0xB0, 0xD0)) | {c for v in titles.values() for c in v.get('ja', '')})
