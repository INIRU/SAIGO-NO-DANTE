#!/usr/bin/env python3
"""
Plan-gift outline for the Assist PiP: the game's yellow neon gift highlight (EGO Gift UI atlas), redrawn along our gift
slot's own outline. The atlas neon belongs to a slot with larger corner cuts, so pasting it misses our corners; its
cross-section (yellow core, orange inner glow, faint outer halo) is sampled from the atlas and laid on the exact edge of
public/assets/game-ui/gift/background.webp. Writes gift/plan-glow.webp and its version.

Usage: python3 scripts/assets/extract-gift-plan-glow.py [atlas.png]
"""
import hashlib
import json
import sys
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ATLAS = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent / 'assets/recovery-2026-09-24/game-ui-sources/EGOGift_1024x2048.png'
SLOT = ROOT / 'public/assets/game-ui/gift/background.webp'
OUT = ROOT / 'public/assets/game-ui/gift/plan-glow.webp'
VERSIONS = ROOT / 'lib/generated/game-ui-versions.json'
# The neon outline in the 1024x2048 atlas and the width of the square slot it surrounds there.
GLOW_BOX = (320, 820, 512, 1020)
ATLAS_SLOT_WIDTH = 173

atlas = np.asarray(Image.open(ATLAS).convert('RGBA'), dtype=float)
# Cross-section of the left edge, averaged over its straight middle: offset from the brightest pixel (+ = inward).
edge = atlas[GLOW_BOX[1] + 80:GLOW_BOX[1] + 120, GLOW_BOX[0]:GLOW_BOX[0] + 40]
alpha = edge[:, :, 3].mean(0)
peak = int(np.argmax(alpha))
weight = np.maximum(edge[:, :, 3:4].sum(0), 1)
color = (edge[:, :, :3] * edge[:, :, 3:4]).sum(0) / weight
offsets = np.arange(len(alpha)) - peak

slot = Image.open(SLOT).convert('RGBA')
ys, xs = np.nonzero(np.asarray(slot)[:, :, 3] > 128)
# The slot is a square with cut corners: four sides and four diagonals, as half-planes.
left, right, top, bottom = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
top_left, bottom_right = (xs + ys).min(), (xs + ys).max() + 2
top_right, bottom_left = (xs - ys).max() + 1, (xs - ys).min()
scale = (right - left) / ATLAS_SLOT_WIDTH
margin = int(np.ceil(offsets.min() * -scale)) + 2

height, width = slot.size[1] + 2 * margin, slot.size[0] + 2 * margin
yy, xx = np.mgrid[0:height, 0:width].astype(float)
x, y = xx - margin + 0.5, yy - margin + 0.5
root2 = np.sqrt(2)
outside = np.max(np.stack([left - x, x - right, top - y, y - bottom, (top_left - (x + y)) / root2, ((x + y) - bottom_right) / root2,
                           ((x - y) - top_right) / root2, (bottom_left - (x - y)) / root2]), axis=0)
# The neon's core sits on the slot edge, as it does around the atlas slot.
inward = -outside / scale - 0.5
pixels = np.dstack([np.interp(inward, offsets, color[:, k]) for k in range(3)] + [np.interp(inward, offsets, alpha, left=0, right=0)])
glow = Image.fromarray(pixels.clip(0, 255).astype(np.uint8))

buffer = BytesIO()
glow.save(buffer, 'WEBP', lossless=True)
OUT.write_bytes(buffer.getvalue())
versions = json.loads(VERSIONS.read_text())
versions['gift/plan-glow'] = hashlib.sha256(buffer.getvalue()).hexdigest()[:12]
VERSIONS.write_text(json.dumps(versions, indent=2, ensure_ascii=False) + '\n')
print('atlas sha256', hashlib.sha256(ATLAS.read_bytes()).hexdigest()[:12], 'glow', glow.size,
      f'inset {margin / slot.size[0] * 100:.4f}% (x) {margin / slot.size[1] * 100:.4f}% (y)')

