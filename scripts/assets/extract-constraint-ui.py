"""Extract original RGBA layers; sources are kept in recovery assets, never repainted."""
from pathlib import Path
from PIL import Image
import json

root = Path(__file__).resolve().parents[2]
sources = root.parent / 'assets/recovery-2026-09-10/constraint-ui-originals'
out = root / 'public/assets/planner/constraint-ui'
out.mkdir(parents=True, exist_ok=True)
# Season 7: Mirror of Names and Spiders, MainUI_MirrorDungeon7_12.
boxes = {
    'card': (12, (0, 0, 486, 690)),
    'selected': (12, (490, 0, 965, 690)),
    'total': (12, (969, 0, 1292, 197)),
}
for score, (left, right) in enumerate([(1305,1450),(1450,1595),(1595,1740),(1740,1885),(1885,2048)], 1):
    boxes[f'score-{score}'] = (12, (left,0,right,150))
for name, (atlas, box) in boxes.items():
    im = Image.open(sources / f'MainUI_MirrorDungeon7_{atlas}.png').crop(box)
    im.save(out / f'md7-{name}.webp', lossless=True)
    assert Image.open(out / f'md7-{name}.webp').getchannel('A').tobytes() == im.getchannel('A').tobytes()
print(f'{len(boxes)} original layers extracted, alpha verified')

# Constraint numbers and floor rules come from season 7; original localization
# supplies names. The two speed values changed from season 6's localized text.
data_dir = root.parent / 'assets/recovery-2026-09-10/complete-data'
data = json.loads((data_dir / 'mirrordungeon-constraint-07.txt').read_text())['list'][0]
texts = {}
for lang, prefix in [('ko', 'KR'), ('en', 'EN'), ('ja', 'JP')]:
    texts[lang] = {r['id']: r for season in [6, 7] for r in json.loads(
        (data_dir / f'{prefix}_BattleKeywords_Mirror{season}.txt').read_text())['dataList']}
for row in data['constraints']:
    n = row['id'] - 995011
    key = f'MD6Limit{100 + n // 5 * 10 + n % 5 + 1}' if n < 25 else f'MD7Limit{101 + (n - 25) * 10}'
    row['keyword_id'] = key
    row['names'] = {lang: text[key]['name'] for lang, text in texts.items()}
    row['descriptions'] = {'ko': row['desc']}
    for lang in ['en', 'ja']:
        desc = texts[lang][key]['desc']
        if key in ['MD6Limit114', 'MD6Limit144']:
            old = '1' if key == 'MD6Limit114' else '2'
            desc = desc.replace(old, str(int(old) + 1))
            desc = ('At Turn End: ' if lang == 'en' else 'ターン終了時：') + desc
        row['descriptions'][lang] = desc
(root / 'lib/generated/mirror-constraints.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
