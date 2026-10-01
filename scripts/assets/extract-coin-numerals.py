"""Coin markers of skill descriptions from the game atlas BattleUI_CoinPopup_1 (2048x2048).

Writes public/assets/game-ui/coins/frame.webp (the bronze octagon frame of a coin slot) and
numerals/1..10.webp (the white Roman numerals I..X the game draws on coins), cropped to their alpha bounds.
Usage: python3 scripts/assets/extract-coin-numerals.py [atlas.png]
"""
import sys
from pathlib import Path

from PIL import Image

ATLAS = Path(sys.argv[1] if len(sys.argv) > 1 else '../assets/recovery-2026-09-10/ui-originals/BattleUI_CoinPopup_1.png')
OUT = Path('public/assets/game-ui/coins')

# (x0, x1) column runs per numeral and the band of rows each row of numerals lies in.
NUMERALS = {
    1: (1399, 1418, 40, 200), 2: (1635, 1693, 40, 200), 3: (1873, 1968, 40, 200),
    4: (79, 176, 290, 470), 5: (351, 417, 290, 470), 6: (592, 688, 290, 470), 7: (829, 963, 290, 470),
    8: (1066, 1238, 290, 470), 9: (1359, 1457, 290, 470), 10: (1630, 1698, 290, 470),
}
FRAME = (12, 1182, 239, 1404)


def trimmed(image: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    part = image.crop(box)
    bounds = part.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
    return part.crop(bounds) if bounds else part


def main() -> None:
    atlas = Image.open(ATLAS).convert('RGBA')
    (OUT / 'numerals').mkdir(parents=True, exist_ok=True)
    trimmed(atlas, FRAME).save(OUT / 'frame.webp', lossless=True)
    for number, (x0, x1, y0, y1) in NUMERALS.items():
        trimmed(atlas, (x0 - 2, y0, x1 + 2, y1)).save(OUT / 'numerals' / f'{number}.webp', lossless=True)
    print(f'wrote {OUT}/frame.webp and {len(NUMERALS)} numerals')


if __name__ == '__main__':
    main()
