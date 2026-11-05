"""Copy the game's term colour into the planner's blessing texts as <k>term</k> (messages/{ko,en,ja}.json).

usage: python3 -I scripts/data/mark-blessing-terms.py <Localize dir> [--write]

<Localize dir> holds kr/KR_, en/EN_, jp/JP_DungeonStartBuffs_MD7.json from the game. Each effect in
planner.blessingTab.blessings is matched against those templates, placeholders as wildcards; the template with the
most literal text wins. The upgrade colour (#f8c200) is dropped, since the card marks changed values itself. Without
--write it prints the marked texts; an effect no template matches is reported and left as it is.
"""
import json, re, sys

gamedir = sys.argv[1]
WRITE = '--write' in sys.argv
LANGS = {'ko': 'kr/KR', 'en': 'en/EN', 'ja': 'jp/JP'}
UP = '#f8c200'
PH = re.compile(r'\{\d\}')
# A placeholder is a number when it can be one (stack counts sit next to buff names), otherwise any text.
NUM_OR_TEXT = r'([+-]?\d[\d.,/~]*%?|.+)'


def terms_only(text):
    out, stack = [], []
    for tok in re.split(r'(<color=[^>]*>|</color>)', text):
        if tok.startswith('<color='):
            stack.append(tok[7:-1].lower())
            if stack[-1] != UP and sum(c != UP for c in stack) == 1: out.append('<k>')
        elif tok == '</color>':
            closed = stack.pop() if stack else ''
            if closed != UP and sum(c != UP for c in stack) == 0: out.append('</k>')
        else:
            out.append(tok)
    return ''.join(out)


def templates(lang):
    out = []
    for row in json.load(open(f'{gamedir}/{LANGS[lang]}_DungeonStartBuffs_MD7.json', encoding='utf-8'))['dataList']:
        marked = terms_only(row.get('description') or '')
        if not marked: continue
        plain = marked.replace('<k>', '').replace('</k>', '')
        rx = re.compile('^' + PH.sub(lambda _: NUM_OR_TEXT, re.escape(plain).replace(r'\{', '{').replace(r'\}', '}')) + '$')
        out.append((len(PH.sub('', plain)), row['id'].endswith('_TEXT_HIGHLIGHT'), rx, marked))
    return sorted(out, key=lambda t: (-t[0], t[1]))


def mark(effect, tps):
    for _, _, rx, marked in tps:
        m = rx.match(effect)
        if m:
            values = iter(m.groups())
            return PH.sub(lambda _: next(values), marked)
    return None


misses = 0
for lang in LANGS:
    path = f'messages/{lang}.json'
    raw = open(path, encoding='utf-8').read()
    # Edit only the blessings object, in place, so the rest of the file keeps its formatting.
    start = raw.index('{', raw.index('"blessings"', raw.index('"blessingTab"')))
    blessings, end = json.JSONDecoder().raw_decode(raw, start)
    block = raw[start:end]
    tps = templates(lang)
    for b in blessings.values():
        for effects in b['effectsByLevel']:
            for effect in effects:
                plain = effect.replace('<k>', '').replace('</k>', '')
                marked = mark(plain, tps)
                if marked is None or marked.replace('<k>', '').replace('</k>', '') != plain:
                    misses += 1; print('MISS', lang, effect); continue
                if not WRITE: print(lang, marked)
                block = block.replace(json.dumps(effect, ensure_ascii=False), json.dumps(marked, ensure_ascii=False))
    if WRITE:
        open(path, 'w', encoding='utf-8').write(raw[:start] + block + raw[end:])
print('misses', misses)
