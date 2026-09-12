"""Remove empty Hangul mappings so browsers can use the existing fallback font.
Run with --apply to repair; default checks the shipped font without modifying it.
"""
import sys
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen

path = Path(__file__).resolve().parents[2] / 'public/fonts/SCDream5.woff2'
font = TTFont(path)
glyphs = font.getGlyphSet()
empty = set()
for code, name in font.getBestCmap().items():
    if 0xAC00 <= code <= 0xD7A3 or 0x3131 <= code <= 0x3163:
        pen = BoundsPen(glyphs)
        glyphs[name].draw(pen)
        if pen.bounds is None:
            empty.add(code)
if '--apply' in sys.argv:
    for table in font['cmap'].tables:
        if table.isUnicode():
            for code in empty:
                table.cmap.pop(code, None)
    font.save(path)
    print(f'Removed {len(empty)} empty Hangul mappings')
else:
    assert not empty, f'{len(empty)} empty Hangul mappings hide typed text'
    print('PASS: no empty Hangul mappings')
