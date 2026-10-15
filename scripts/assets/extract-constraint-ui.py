"""Extract original RGBA layers; sources are kept in recovery assets, never repainted."""
from pathlib import Path
from PIL import Image
import json

root = Path(__file__).resolve().parents[2]
sources = root.parent / 'assets/recovery-2026-09-10/constraint-ui-originals'
out = root / 'public/assets/planner/constraint-ui'
out.mkdir(parents=True, exist_ok=True)
# Season 8 (2026-10-15): atlases MainUI_MirrorDungeon8_3 and _2 from the game install's sharedassets2.assets.
# card/selected/total are the sprites 8_3_2, 8_3_3, 8_2_21 (their m_Rect, top-left origin); the score badges have no
# sprite, their boxes are the badges' alpha bounds (231x197 each, glow included).
boxes = {
    'card': (3, (25, 1068, 372, 1537)),
    'selected': (3, (405, 1067, 752, 1539)),
    'total': (2, (12, 1618, 419, 1832)),
}
for score, (left, top) in enumerate([(1150, 1285), (1396, 1283), (1644, 1282), (1153, 1537), (1398, 1537)], 1):
    boxes[f'score-{score}'] = (2, (left, top, left + 231, top + 197))
for name, (atlas, box) in boxes.items():
    im = Image.open(sources / f'MainUI_MirrorDungeon8_{atlas}.png').crop(box)
    im.save(out / f'md8-{name}.webp', lossless=True)
    assert Image.open(out / f'md8-{name}.webp').getchannel('A').tobytes() == im.getchannel('A').tobytes()
print(f'{len(boxes)} original layers extracted, alpha verified')

# Constraint numbers and floor rules come from season 8 (same 30 as season 7; reward is starlight only); original localization
# supplies names. The two speed values changed from season 6's localized text.
data_dir = root.parent / 'assets/recovery-2026-09-10/complete-data'
data = json.loads((data_dir / 'mirrordungeon-constraint-08.txt').read_text())['list'][0]
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
