#!/usr/bin/env python3
"""
Splits public/fonts/PretendardVariable.woff2 (2 MB) into unicode-range pieces, so a page downloads only the pieces of
the characters it shows.

- latin: Latin, punctuation, arrows and CJK punctuation (preloaded; also the en/ja bold headings).
- hangul-1 … hangul-N: Hangul syllables by how often the site uses them (scripts/assets/hangul-frequency.txt, the game
  text, plus messages/ko.json weighted up because the UI text is on every page), then the rest of the 2,350 KS X 1001
  syllables in code order. hangul-1 is preloaded; the others load when a page shows one of their syllables.
- symbols: the other symbols Pretendard had in its old core (math, enclosed numbers, compatibility jamo, units,
  full-width forms).
- ext: every other glyph of the font (rare syllables, kana, Cyrillic, ...).

Every piece lists exactly the code points it has, so a character missing from it never triggers its download. Writes
the woff2 files to public/fonts/pretendard/ and the next/font declarations to app/pretendard.ts.

  pip install fonttools brotli
  python3 scripts/assets/subset-pretendard.py
"""
import json
import os
from collections import Counter
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SOURCE = os.path.join(ROOT, 'public/fonts/PretendardVariable.woff2')
OUT_DIR = os.path.join(ROOT, 'public/fonts/pretendard')
MODULE = os.path.join(ROOT, 'app/pretendard.ts')
FREQUENCY = os.path.join(ROOT, 'scripts/assets/hangul-frequency.txt')
UI_MESSAGES = os.path.join(ROOT, 'messages/ko.json')

# Basic Latin and Latin-1, general punctuation, arrows, math operators, technical symbols (⌘), geometric shapes (◆),
# misc symbols (★), CJK punctuation, compatibility jamo: the characters the UI and posts use on most pages.
LATIN_BLOCKS = [(0x0020, 0x00FF), (0x2000, 0x206F), (0x2190, 0x23FF), (0x25A0, 0x26FF), (0x3000, 0x303F), (0x3131, 0x318F)]
# The rest of the old core: Latin Extended, spacing modifiers, letterlike symbols, enclosed numbers, dingbats,
# enclosed CJK, units, full-width forms.
SYMBOL_BLOCKS = [(0x0100, 0x024F), (0x02B0, 0x02FF), (0x2070, 0x218F), (0x2400, 0x259F), (0x2700, 0x2BFF),
                 (0x3200, 0x33FF), (0xFF00, 0xFFEF)]
# Syllables per Hangul piece, most frequent first; the last piece takes what is left of KS X 1001.
PIECE_SIZES = [400, 400, 450, 500]
# A UI syllable is on every page: one occurrence in messages/ko.json counts like this many in the game text.
UI_WEIGHT = 100


def ks_x_1001_syllables():
    syllables = set()
    for high in range(0xB0, 0xC9):
        for low in range(0xA1, 0xFF):
            try:
                char = bytes([high, low]).decode('euc_kr')
            except UnicodeDecodeError:
                continue
            if 0xAC00 <= ord(char) <= 0xD7A3:
                syllables.add(ord(char))
    return syllables


def site_frequency():
    counts = Counter()
    with open(FREQUENCY, encoding='utf8') as source:
        for line in source:
            if line.startswith('#'):
                continue
            for pair in line.split():
                char, count = pair.rsplit(':', 1)
                counts[ord(char)] += int(count)

    def walk(value):
        if isinstance(value, dict):
            for item in value.values():
                walk(item)
        elif isinstance(value, list):
            for item in value:
                walk(item)
        elif isinstance(value, str):
            for char in value:
                if 0xAC00 <= ord(char) <= 0xD7A3:
                    counts[ord(char)] += UI_WEIGHT

    with open(UI_MESSAGES, encoding='utf8') as source:
        walk(json.load(source))
    return counts


def unicode_range(codes, earlier=frozenset()):
    # The browser takes, per character, the first piece in --font-pretendard whose range has it. A range may span
    # characters an earlier piece already has: they never reach this piece, and the declaration gets much shorter.
    ranges = []
    for code in sorted(codes):
        if ranges and all(gap in earlier for gap in range(ranges[-1][1] + 1, code)):
            ranges[-1][1] = code
        else:
            ranges.append([code, code])
    return ','.join(f'U+{a:X}' if a == b else f'U+{a:X}-{b:X}' for a, b in ranges)


def parse_range(value):
    codes = set()
    for part in value.split(','):
        first, _, last = part[2:].partition('-')
        codes.update(range(int(first, 16), int(last or first, 16) + 1))
    return codes


def write_subset(codes, name):
    options = subset.Options()
    options.flavor = 'woff2'
    options.layout_features = ['*']
    options.name_IDs = ['*']
    options.notdef_outline = True
    font = TTFont(SOURCE)
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=codes)
    subsetter.subset(font)
    font.flavor = 'woff2'
    path = os.path.join(OUT_DIR, name)
    font.save(path)
    # Layout features can pull in other mapped characters: a piece declares only the characters it was cut for.
    kept = set(TTFont(path).getBestCmap()) & codes
    print(f'{name}: {len(kept)} code points, {os.path.getsize(path) // 1024} KB')
    return kept


def in_blocks(code, blocks):
    return any(a <= code <= b for a, b in blocks)


def declaration(name, file, variable, codes, preload, doc, fallback=True, earlier=frozenset()):
    options = [
        f"  src: '../public/fonts/pretendard/{file}',",
        "  weight: '45 920',",
        "  style: 'normal',",
        f"  variable: '{variable}',",
        "  display: 'swap',",
        f"  preload: {'true' if preload else 'false'},",
        # Only the metric-matched Arial fallback: a system Hangul font here would draw every syllable before the
        # Hangul pieces that follow in --font-pretendard get a chance.
        *([] if fallback else ['  adjustFontFallback: false,']),
        f"  declarations: [{{ prop: 'unicode-range', value: '{unicode_range(codes, earlier)}' }}],",
    ]
    # Only pretendardPieces leaves the module, so each piece is a plain const.
    return f"/** {doc} */\nconst {name} = localFont({{\n" + '\n'.join(options) + '\n})\n'


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for old in os.listdir(OUT_DIR):
        if old.endswith('.woff2'):
            os.remove(os.path.join(OUT_DIR, old))
    cmap = set(TTFont(SOURCE).getBestCmap())
    latin = {code for code in cmap if in_blocks(code, LATIN_BLOCKS)}
    symbols = {code for code in cmap if in_blocks(code, SYMBOL_BLOCKS)} - latin
    frequency = site_frequency()
    common = ks_x_1001_syllables() & cmap
    seen = sorted((code for code in frequency if code in cmap), key=lambda code: -frequency[code])
    ranked = seen + sorted(common - set(seen))

    latin_kept = write_subset(latin, 'PretendardVariable-latin.woff2')
    symbols_kept = write_subset(symbols, 'PretendardVariable-symbols.woff2') - latin_kept
    pieces, start = [], 0
    for index, size in enumerate(PIECE_SIZES + [len(ranked)]):
        codes = set(ranked[start:start + size])
        start += size
        if not codes:
            break
        pieces.append(write_subset(codes, f'PretendardVariable-hangul-{index + 1}.woff2'))
    claimed = latin_kept | symbols_kept | set().union(*pieces)
    ext_kept = write_subset(cmap - claimed, 'PretendardVariable-ext.woff2') - claimed
    write_module(latin_kept, pieces, symbols_kept, ext_kept)


def write_module(latin_kept, pieces, symbols_kept, ext_kept):
    parts = [declaration('pretendardLatin', 'PretendardVariable-latin.woff2', '--font-pretendard-latin', latin_kept, True,
                         'Latin, punctuation, common UI symbols, CJK punctuation and jamo: preloaded on every page.')]
    earlier = set(latin_kept)
    for index, codes in enumerate(pieces):
        doc = ('The most frequent syllables on the site (UI text first): preloaded on every page.' if index == 0 else
               f'Hangul piece {index + 1} by site frequency: downloaded when a page shows one of its syllables.')
        parts.append(declaration(f'pretendardHangul{index + 1}', f'PretendardVariable-hangul-{index + 1}.woff2',
                                 f'--font-pretendard-hangul-{index + 1}', codes, index == 0, doc, fallback=False,
                                 earlier=frozenset(earlier)))
        earlier |= codes
    parts.append(declaration('pretendardSymbols', 'PretendardVariable-symbols.woff2', '--font-pretendard-symbols',
                             symbols_kept, False, 'Other symbols, compatibility jamo, units and full-width forms.', fallback=False,
                             earlier=frozenset(earlier)))
    earlier |= symbols_kept
    parts.append(declaration('pretendardExt', 'PretendardVariable-ext.woff2', '--font-pretendard-ext', ext_kept, False,
                             'The rest of Pretendard (rare syllables, kana, Cyrillic, ...).', fallback=False,
                             earlier=frozenset(earlier)))
    heading = f'''/** en/ja headings are always bold, like KOTRA Bold on Korean pages; other characters fall through to --font-pretendard. */
export const pretendardHeadingLatin = localFont({{
  src: '../public/fonts/pretendard/PretendardVariable-latin.woff2',
  weight: '700',
  variable: '--font-heading-latin',
  display: 'swap',
  preload: false,
  fallback: ['Segoe UI', 'sans-serif'],
  declarations: [{{ prop: 'unicode-range', value: '{unicode_range(latin_kept)}' }}],
}})
'''
    names = ', '.join(['pretendardLatin'] + [f'pretendardHangul{i + 1}' for i in range(len(pieces))] + ['pretendardSymbols', 'pretendardExt'])
    with open(MODULE, 'w', encoding='utf8') as out:
        out.write('// Generated by scripts/assets/subset-pretendard.py; do not edit by hand.\n'
                  '// next/font needs literal options, so the unicode ranges are written out here.\n'
                  "import localFont from 'next/font/local'\n\n" + '\n'.join(parts) + '\n' + heading +
                  '\n/** In --font-pretendard order (app/globals.css): the browser takes, per character, the first piece that has it. */\n'
                  f'export const pretendardPieces = [{names}]\n')
    print(f'wrote {os.path.relpath(MODULE, ROOT)}')


def rewrite_ranges():
    """Rewrites app/pretendard.ts from its own declarations, leaving the woff2 pieces as they are."""
    import re
    with open(MODULE, encoding='utf8') as source:
        text = source.read()
    declared = {name: parse_range(value) for name, value in
                re.findall(r"^const (pretendard\w+) = localFont\(\{.*?unicode-range', value: '([^']+)'", text, re.S | re.M)}
    hangul = [declared[f'pretendardHangul{i}'] for i in range(1, 100) if f'pretendardHangul{i}' in declared]
    # A range written with spans includes earlier pieces' characters: a piece's own set is what is left without them.
    latin = declared['pretendardLatin']
    earlier, pieces = set(latin), []
    for codes in hangul:
        pieces.append(codes - earlier)
        earlier |= pieces[-1]
    symbols = declared['pretendardSymbols'] - earlier
    ext = declared['pretendardExt'] - earlier - symbols
    write_module(latin, pieces, symbols, ext)


if __name__ == '__main__':
    import sys
    rewrite_ranges() if '--ranges-only' in sys.argv else main()
