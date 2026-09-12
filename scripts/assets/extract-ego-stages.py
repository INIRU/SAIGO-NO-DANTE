#!/usr/bin/env python3
"""Extract interpretation numerals from the user's game atlas, preserving alpha."""
import argparse, hashlib, json
from pathlib import Path
from PIL import Image

# Native 2048x2048 atlas coordinates. Transparent RGB padding is trimmed by alpha.
REGIONS = {1: (1348, 798, 1399, 983), 2: (1236, 798, 1329, 983), 3: (1056, 798, 1207, 983),
           4: (1055, 995, 1256, 1173), 5: (1056, 1180, 1215, 1366)}

def normalize_numeral(numeral: Image.Image):
    # The glow extends by different amounts. Match the opaque glyph height,
    # not the width or transparent bounding box, then use an identical canvas.
    core = numeral.getchannel('A').point(lambda alpha: 255 if alpha >= 224 else 0).getbbox()
    if core is None:
        raise ValueError('Numeral has no solid glyph')
    scale = 128 / (core[3] - core[1])
    scaled = numeral.resize((round(numeral.width * scale), round(numeral.height * scale)), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (224, 192))
    x = round(112 - (core[0] + core[2]) * scale / 2)
    y = round(96 - (core[1] + core[3]) * scale / 2)
    if x < 0 or y < 0 or x + scaled.width > canvas.width or y + scaled.height > canvas.height:
        raise ValueError('Numeral would be clipped by the output canvas')
    canvas.alpha_composite(scaled, (x, y))
    return canvas, core

def extract(source: Path, output: Path):
    atlas = Image.open(source).convert('RGBA')
    if atlas.size != (2048, 2048):
        raise ValueError(f'Unexpected atlas size: {atlas.size}')
    output.mkdir(parents=True, exist_ok=True)
    entries = []
    for level, bounds in REGIONS.items():
        numeral = atlas.crop(bounds)
        alpha_bounds = numeral.getchannel('A').getbbox()
        if alpha_bounds is None:
            raise ValueError(f'Empty numeral {level}')
        numeral = numeral.crop(alpha_bounds)
        numeral, core_bounds = normalize_numeral(numeral)
        target = output / f'{level}.webp'
        numeral.save(target, 'WEBP', lossless=True)
        entries.append({'level': level, 'bounds': bounds, 'alphaBounds': alpha_bounds, 'coreBounds': core_bounds, 'size': numeral.size,
                        'sha256': hashlib.sha256(target.read_bytes()).hexdigest()})
    (output / 'source.json').write_text(json.dumps({'source': source.name, 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'entries': entries}, indent=2))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    extract(args.source, args.output)
