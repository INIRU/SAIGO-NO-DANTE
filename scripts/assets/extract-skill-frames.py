"""Crop and tint original game UI atlases without downloading reference-site assets.

Usage: python3 scripts/assets/extract-skill-frames.py /path/to/ui-originals
Requires Pillow. Coordinates use the unscaled 2048px export, top-left origin.
The full 512px cell is retained so the frame and skill icon share their center.
"""

import argparse
import hashlib
import json
import re
from pathlib import Path

from PIL import Image, ImageChops, ImageColor

ROOT = Path(__file__).resolve().parents[2]
SINS = ('wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy')
CELL = 512


def tint(image, color):
    """Unity-style vertex color multiplication, preserving original alpha/shading."""
    result = ImageChops.multiply(image.convert('RGB'), Image.new('RGB', image.size, color))
    result.putalpha(image.getchannel('A'))
    return result


def crop_cell(image, column, row):
    box = (column * CELL, row * CELL, (column + 1) * CELL, (row + 1) * CELL)
    if image.size != (2048, 2048) or box[2] > image.width or box[3] > image.height:
        raise ValueError('Unexpected atlas dimensions or cell coordinates')
    return image.crop(box), box


def extract(source, output):
    palette = json.loads((ROOT / 'scripts/assets/skill-frame-palette.json').read_text())
    colors, base_colors = palette['outline'], palette['base']
    if set(colors) != set(SINS) | {'neutral'} or colors.keys() != base_colors.keys():
        raise ValueError('Expected seven sins and neutral in both frame layers')
    output.mkdir(parents=True, exist_ok=True)
    atlases = {name: Image.open(source / name).convert('RGBA') for name in (
        'Icon_skillFrame_1.png', 'Icon_skillFrame_3.png',
        'Icon_skillFrame_Invert.png', 'Icon_skillFrame_Invert_2.png',
    )}
    manifest = {
        'sourceFolder': 'https://drive.google.com/drive/folders/1Nk9WWMxEcovs5Ewku5ICT1PbfByNcV_z',
        'method': '512px cell crop; separate silhouette and ornament colors from skill-frame-palette.json; alpha unchanged; lossless WebP',
        'sources': {name: hashlib.sha256((source / name).read_bytes()).hexdigest() for name in atlases},
        'outputs': [],
        'defense': 'Slot 4 reuses slot 1; all neutral slots reuse neutral-1. Both image layers share canonical files and URLs.',
    }
    versions = {}

    def save(image, name, color, atlas, box):
        result = tint(image, color)
        result.save(output / name, format='WEBP', lossless=True, method=6)
        versions[name] = hashlib.sha256((output / name).read_bytes()).hexdigest()[:12]
        manifest['outputs'].append({'file': name, 'source': atlas, 'crop': box, 'color': color})

    for index, sin in enumerate(SINS):
        for slot in (1, 2, 3):
            name = 'Icon_skillFrame_1.png' if slot == 3 else 'Icon_skillFrame_3.png'
            row = index // 4 + (2 if slot == 2 else 0)
            cell, box = crop_cell(atlases[name], index % 4, row)
            save(cell, f'{sin}-{slot}.webp', colors[sin], name, box)
            base_name = 'Icon_skillFrame_Invert.png' if slot == 3 else 'Icon_skillFrame_Invert_2.png'
            base_row = index // 4 + (2 if slot in (2, 3) else 0)
            base, base_box = crop_cell(atlases[base_name], index % 4, base_row)
            save(base, f'{sin}-{slot}-base.webp', base_colors[sin], base_name, base_box)

    # Undecorated neutral frame; never silently use the wrath ornament for defense.
    name = 'Icon_skillFrame_1.png'
    cell, box = crop_cell(atlases[name], 0, 3)
    for slot in (1,):
        save(cell, f'neutral-{slot}.webp', colors['neutral'], name, box)
        base, base_box = crop_cell(atlases['Icon_skillFrame_Invert.png'], 3, 3)
        save(base, f'neutral-{slot}-base.webp', base_colors['neutral'], 'Icon_skillFrame_Invert.png', base_box)

    # The original attack-type badge is a separate small heptagon in cell (0, 2).
    cell, cell_box = crop_cell(atlases[name], 0, 2)
    bounds = cell.getchannel('A').getbbox()
    if bounds is None:
        raise ValueError('Attack badge alpha is empty')
    badge_base, base_box = crop_cell(atlases['Icon_skillFrame_Invert.png'], 2, 3)
    for sin, color in colors.items():
        result = tint(badge_base, base_colors[sin])
        result.alpha_composite(tint(cell, color))
        result = result.crop(result.getchannel('A').getbbox())
        file = f'{sin}-badge.webp'
        result.save(output / file, format='WEBP', lossless=True, method=6)
        versions[file] = hashlib.sha256((output / file).read_bytes()).hexdigest()[:12]
        manifest['outputs'].append({'file': file, 'source': name, 'crop': cell_box,
                                    'baseSource': 'Icon_skillFrame_Invert.png', 'baseCrop': base_box,
                                    'color': color, 'baseColor': base_colors[sin]})
    (output / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    generated = ROOT / 'lib/generated/skill-frame-versions.json'
    generated.parent.mkdir(parents=True, exist_ok=True)
    generated.write_text(json.dumps(versions, sort_keys=True, indent=2) + '\n')
    print(f'Extracted {len(manifest["outputs"])} frame/badge assets into {output}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--output', type=Path, default=ROOT / 'public/assets/skill-frames')
    args = parser.parse_args()
    extract(args.source, args.output)
