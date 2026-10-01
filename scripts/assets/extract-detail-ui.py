"""Extract source UI sprites with a shared optical canvas; never tint precolored icons.

Usage: python3 scripts/assets/extract-detail-ui.py RECOVERY_ROOT
The user's Unity PNG exports remain outside the repo. Public outputs are lossless WebP.
"""
import hashlib
import json
import sys
from collections import deque
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SINS = ['wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy']
SINNERS = ['yi-sang', 'faust', 'don-quixote', 'ryoshu', 'meursault', 'hong-lu', 'heathcliff', 'ishmael', 'rodion', 'sinclair', 'outis', 'gregor']
# These sprites are present in the full atlases but absent from the named exports.
# Native 128px cells, including glow; no recoloring or replacement with other buffs.
KEYWORD_CROPS = {
    'tiantui-star': ('Icon_buf_18_3.png', (896, 768, 1024, 896)),
    'shin-tiantui-star': ('Icon_buf_18_3.png', (896, 896, 1024, 1024)),
    'tremor-burst': ('Icon_buf_3.png', (512, 384, 640, 512)),
    'shimmering-bloodfiend': ('Icon_buf_15.png', (512, 128, 640, 256)),
}


def extract(base, output):
    records = []
    generated = ROOT / 'lib/generated/game-ui-versions.json'
    versions = json.loads(generated.read_text()) if generated.exists() else {}

    def save(source, name, box=None, canvas=None, trim=False):
        original = Image.open(source).convert('RGBA')
        sprite = original.crop(box) if box else original
        if name.startswith('stats/'):
            # Tight packed atlas cells overlap neighboring alpha at their margins.
            # Each stat glyph is connected; keep its component, not neighboring shards.
            alpha = sprite.getchannel('A')
            pixels = alpha.load()
            pending = {(x, y) for y in range(sprite.height) for x in range(sprite.width) if pixels[x, y] > 0}
            groups = []
            while pending:
                first = pending.pop()
                group, queue = {first}, deque([first])
                while queue:
                    x, y = queue.popleft()
                    for neighbor in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
                        if neighbor in pending:
                            pending.remove(neighbor)
                            group.add(neighbor)
                            queue.append(neighbor)
                groups.append(group)
            keep = max(groups, key=len)
            for group in groups:
                if group is not keep:
                    for point in group:
                        pixels[point] = 0
            sprite.putalpha(alpha)
        bounds = sprite.getchannel('A').getbbox()
        if bounds is None:
            raise ValueError(f'Empty crop: {name}')
        if trim or canvas:
            sprite = sprite.crop(bounds)
        if canvas:
            sprite.thumbnail((canvas - 16, canvas - 16), Image.Resampling.LANCZOS)
            centered = Image.new('RGBA', (canvas, canvas))
            centered.alpha_composite(sprite, ((canvas - sprite.width) // 2, (canvas - sprite.height) // 2))
            sprite = centered
        target = output / (name + '.webp')
        target.parent.mkdir(parents=True, exist_ok=True)
        sprite.save(target, 'WEBP', lossless=True, exact=True)
        versions[name] = hashlib.sha256(target.read_bytes()).hexdigest()[:12]
        records.append({'file': name + '.webp', 'source': str(source.relative_to(base)),
                        'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                        'crop': box, 'alphaBounds': bounds, 'canvas': canvas, 'trim': trim,
                        'width': sprite.width, 'height': sprite.height})

    atlas = base / 'ui-originals/MainUI_PersonalityList_4.png'
    for index, sin in enumerate(SINS):
        # Keep native 256px cell alignment; these already contain their original colors.
        save(atlas, 'sins/' + sin, (index * 256, 0, (index + 1) * 256, 256))
    for name, box in {
        # Full connected-component bounds from the native atlas, not guessed cell edges.
        'health': (1410, 1052, 1537, 1168), 'defense': (1539, 1047, 1661, 1174),
        'slash': (1663, 1056, 1791, 1165), 'offense': (1818, 1051, 1943, 1178),
        'speed': (1282, 1176, 1402, 1304), 'blunt': (1537, 1177, 1665, 1302),
        'pierce': (1665, 1190, 1793, 1291),
    }.items():
        save(atlas, 'stats/' + name, box, canvas=160)
    for rarity, box in {
        1: (0, 1750, 256, 2016), 2: (532, 1750, 792, 2016), 3: (264, 1750, 526, 2016),
    }.items():
        save(base / 'ui-originals/MainUI_PersonalityList_8.png', f'rarity/{rarity}', box, canvas=288)
    for name, box in {'increase': (400, 200, 675, 435), 'decrease': (685, 215, 940, 455)}.items():
        save(base / 'ui-originals/New_MainUI_PersonalityList_2.png', 'sanity/' + name, box, canvas=288)
    for name, box in {'normal': (0, 0, 256, 256), 'unbreakable': (768, 0, 1024, 256)}.items():
        save(base / 'ui-originals/BattleUI_NewCoin.png', 'coins/' + name, box, canvas=272)
    entries = json.loads((base / 'detail-ui-source-manifest.json').read_text())
    for item in entries:
        source = base / 'image-originals' / (item['id'] + '.png')
        if '/Sanity/' in item['path']:
            save(source, 'sanity/' + ('9994' if item['name'] == '9994.png' else '9999'), canvas=288)
        elif item['name'].endswith('_number.png'):
            number = int(item['name'].split('_')[0])
            index = number - 1 if number < 10 else number - 2
            save(source, 'sinners/' + SINNERS[index])
    icon_sources = {entry['name']: entry for entry in json.loads((base / 'drive-complete-icons.json').read_text())['files']
                    if entry['path'].startswith('icons/Status Effects/Icon_buf_')}
    for name, (atlas_name, bounds) in KEYWORD_CROPS.items():
        entry = icon_sources[atlas_name]
        source = base / 'image-originals' / (entry['id'] + '.png')
        save(source, 'keywords/' + name, bounds)
        records[-1].update({'driveId': entry['id'], 'drivePath': entry['path']})
    all_icons = json.loads((base / 'drive-complete-icons.json').read_text())['files']
    for number in range(100, 110):
        entry = next(item for item in all_icons if item['path'] == f'icons/Mirror Dungeon/Mirror of the Dreaming/StartBuffIcon_{number}.png')
        save(base / 'image-originals' / (entry['id'] + '.png'), f'start-buffs/{number}')
        records[-1].update({'driveId': entry['id'], 'drivePath': entry['path']})
    entry = next(item for item in all_icons if item['path'] == 'icons/Resources/MainUI_CommonIcon_4.png')
    # Full native cell preserves the five stars and their low-alpha glow.
    save(base / 'image-originals' / (entry['id'] + '.png'), 'start-buffs/starlight', (0, 0, 256, 256))
    records[-1].update({'driveId': entry['id'], 'drivePath': entry['path']})
    save(base / 'image-originals' / (entry['id'] + '.png'), 'resources/md-pass', (1792, 0, 2048, 256))
    records[-1].update({'driveId': entry['id'], 'drivePath': entry['path']})
    all_ui = json.loads((base / 'drive-complete-ui.json').read_text())['files']
    for name, atlas_name, box in [
        ('gift/background', 'MainUI_BattleSelection_15.png', (846, 1, 1200, 352)),
        ('gift/grade-ex', 'MainUI_MirrorDungeon6_5.png', (1719, 1760, 1838, 1882)),
    ]:
        entry = next(item for item in all_ui if item['name'] == atlas_name)
        # Full native alpha component, including the faint outer glow.
        save(base / 'ui-originals' / atlas_name, name, box)
        records[-1].update({'driveId': entry['id'], 'drivePath': entry['path']})
    (output / 'source.json').write_text(json.dumps({'sourceFolder': 'https://drive.google.com/drive/folders/1Nk9WWMxEcovs5Ewku5ICT1PbfByNcV_z', 'outputs': records}, indent=2) + '\n')
    generated = ROOT / 'lib/generated/game-ui-versions.json'
    generated.parent.mkdir(parents=True, exist_ok=True)
    generated.write_text(json.dumps(versions, indent=2, sort_keys=True) + '\n')
    print(f'Extracted {len(records)} original detail UI sprites')


if __name__ == '__main__':
    extract(Path(sys.argv[1]).resolve(), ROOT / 'public/assets/game-ui')
