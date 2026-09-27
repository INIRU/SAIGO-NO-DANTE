#!/usr/bin/env python3
"""Build the training/evaluation folder for scripts/vision/train_icons.py.

  python3 scripts/vision/build_icon_dataset.py --samples <downloaded assist samples> --rows <rows.json> \
      --replay <replay_fusion_samples.ts output> --out <dir> [--extra-real <dir with real/ and real.json>]

1. Catalog icons (ego_gifts.image_url) and the site's keyword icons for the badges (needs .env.local).
2. From the fusion sample replay: blank slots become slot backgrounds; slots read strongly (score >= 0.85, lead >= 0.25) or
   read at >= 0.6 as one of the materials their complete dialog named become labelled real crops (vestiges as one class).
   Windows wider than 16:9 are skipped (their slots need the OCR anchors). Crops are 1.3x the app's slot region at 96 px.
3. ring.png: the site's game slot background with its octagon cut out, the hazard stripes a filled slot shows.
"""
import argparse, json, subprocess, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
from PIL import Image

VESTIGES = {'9991', '9992', '9993', '9994', '9995'}
DIALOG = {3: ([373, 697, 1021], 458, 180), 5: ([296, 490, 686, 880, 1074], 464, 100)}
WHEEL = {3: ([(544, 308), (337, 515), (751, 515)], 98), 5: ([(554, 316), (357, 388), (746, 388), (357, 543), (746, 543)], 98)}
BADGES = ['burn', 'bleed', 'tremor', 'rupture', 'sinking', 'breath', 'charge', 'slash', 'pierce', 'blunt']


def group(gift_id):
    return '9991' if gift_id in VESTIGES else gift_id


def game_view(image):
    """The 16:9 game view below a light window title bar, as the frame's scale and offsets."""
    luminance = np.asarray(image.convert('L'), np.float32)[:60].mean(1)
    bar = 0
    for y, value in enumerate(luminance):
        if value > 150:
            bar = y + 1
        elif y > bar + 2:
            break
    height = image.height - bar
    scale = min(image.width / 1920, height / 1080)
    return scale, (image.width - 1920 * scale) / 2, bar + (height - 1080 * scale) / 2


def crop(image, x, y, side, size=96):
    half = side * 1.3 / 2
    return image.crop((round(x - half), round(y - half), round(x + half), round(y + half))).resize((size, size), Image.BILINEAR)


def fetch(url, path):
    if not path.exists():
        with urllib.request.urlopen(url) as response:
            path.write_bytes(response.read())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--samples', type=Path, required=True)
    parser.add_argument('--rows', type=Path, required=True)
    parser.add_argument('--replay', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    out = args.out
    for sub in ('icons', 'badges', 'bg/wheel', 'bg/dialog', 'real'):
        (out / sub).mkdir(parents=True, exist_ok=True)

    # 1. Catalog and badge icons, through the site's own code for the badge URLs.
    script = ("import { getGiftKeywordIconUrl } from './lib/constants/gift';"
              "import { createClient } from '@supabase/supabase-js';"
              "require('dotenv').config({ path: '.env.local', quiet: true });"
              "(async () => { const { data, error } = await createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!)"
              ".schema('limbus').from('ego_gifts').select('game_id,name,grade,keyword,image_url'); if (error) throw error;"
              f"console.log(JSON.stringify({{ gifts: data, badges: Object.fromEntries({json.dumps(BADGES)}.map(s => [s, getGiftKeywordIconUrl(s)])) }})) }})()")
    listing = json.loads(subprocess.run(['npx', 'tsx', '-e', script], capture_output=True, text=True, check=True).stdout)
    (out / 'gifts.json').write_text(json.dumps(listing['gifts'], ensure_ascii=False))
    with ThreadPoolExecutor(16) as pool:
        list(pool.map(lambda gift: fetch(gift['image_url'], out / 'icons' / f"{gift['game_id']}.webp"), [g for g in listing['gifts'] if g['image_url']]))
    for slug, url in listing['badges'].items():
        fetch(url if url.startswith('http') else 'https://saigo-no-dante.com' + url, out / 'badges' / f'{slug}.webp')

    # 2. Backgrounds and labelled real crops from the replayed fusion samples.
    rows = {row['path']: row for row in json.load(open(args.rows))}
    replay = json.load(open(args.replay))
    real, backgrounds, seen = [], 0, set()
    for dialog in replay['dialogs'] if isinstance(replay, dict) else replay:
        meta = rows[dialog['path']]['meta']
        if meta['width'] / meta['height'] > 1.8:
            continue
        materials = {group(m) for m in dialog['materials']}
        for read in dialog['reads']:
            frame = round(read['observedAt'] / 300)
            file = args.samples / dialog['path'] / f'{frame}.jpg'
            image = None
            for index, slot in enumerate(read['slots']):
                key = (dialog['path'], frame, read['view'], index)
                if slot is None or key in seen or not file.exists():
                    continue
                seen.add(key)
                blank = bool(slot.get('blank'))
                strong = not blank and slot['score'] >= 0.85 and slot['margin'] >= 0.25
                mid = not blank and not strong and dialog['complete'] and slot['score'] >= 0.6 and group(slot['id']) in materials
                if not (blank or strong or mid):
                    continue
                image = image or Image.open(file).convert('RGB')
                scale, left, top = game_view(image)
                if read['view'] == 'dialog':
                    xs, y, side = DIALOG[dialog['capacity']]
                    x = xs[index]
                else:
                    centers, side = WHEEL[dialog['capacity']]
                    x, y = centers[index]
                tile = crop(image, left + x * scale, top + y * scale, side * scale)
                if blank:
                    tile.save(out / 'bg' / read['view'] / f's{backgrounds}.png')
                    backgrounds += 1
                else:
                    name = f"{dialog['path'][11:19]}_{frame}_{read['view'][0]}_{index}.png"
                    tile.save(out / 'real' / name)
                    real.append({'file': name, 'id': group(slot['id']), 'kind': 'strong' if strong else 'mid', 'view': read['view'], 'size': meta['width']})
    extra = out / 'real-extra.json'
    if extra.exists():
        real += json.load(open(extra))
    (out / 'real.json').write_text(json.dumps(real, ensure_ascii=False))

    # 3. The hazard-striped ring of a filled slot.
    ring = np.asarray(Image.open('public/assets/game-ui/gift/background.webp').convert('RGBA').resize((256, 256), Image.LANCZOS)).astype(np.float32)
    yy, xx = np.mgrid[0:256, 0:256]
    dx, dy = np.abs(xx - 127.5) / 256, np.abs(yy - 127.5) / 256
    ring[..., 3] = np.where((np.maximum(dx, dy) < 0.33) & (dx + dy < 0.46), 0, ring[..., 3])
    Image.fromarray(ring.astype(np.uint8)).save(out / 'ring.png')
    print('icons', len(list((out / 'icons').glob('*.webp'))), 'backgrounds', backgrounds, 'real', len(real))


if __name__ == '__main__':
    main()
