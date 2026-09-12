"""Extract original E.G.O card layers; artwork and localized text stay dynamic."""
import argparse, hashlib, json
from pathlib import Path
from PIL import Image, ImageChops

PANEL_SOURCE = 'New_MainUI_Formation_1.png'
PANEL_CROP = (1690, 908, 2048, 1063)
# Estimated by fitting the existing lossy WebPs, NOT recovered game color metadata.
# These reproduce the composition, not the original encoder's exact output.
PANEL_TINTS = {
 'wrath': ('01', (255, 0, 0)), 'lust': ('07', (255, 108, 1)),
 'sloth': ('03', (255, 204, 44)), 'gluttony': ('06', (153, 243, 0)),
 'gloom': ('04', (23, 195, 236)), 'pride': ('05', (0, 74, 211)),
 'envy': ('02', (141, 1, 209)),
}

def panel_recipe(source, reference):
    base = Image.open(source/PANEL_SOURCE).convert('RGBA').crop(PANEL_CROP)
    alpha = base.getchannel('A').tobytes()
    panels = []
    for sin, (number, tint) in PANEL_TINTS.items():
        key = f'sin-frames/sin-frame-candidate-{number}.webp'
        retained = reference/key
        entry = {'sin': sin, 'file': key, 'estimatedTintRgb': tint}
        if retained.exists():
            im = Image.open(retained).convert('RGBA')
            if im.size != base.size or im.getchannel('A').tobytes() != alpha:
                raise ValueError(f'Panel source alpha mismatch: {key}')
            entry.update({'alphaMatchesSourceExactly': True,
                          'retainedSha256': hashlib.sha256(retained.read_bytes()).hexdigest()})
        panels.append(entry)
    return base, {'source': PANEL_SOURCE,
        'sourceSha256': hashlib.sha256((source/PANEL_SOURCE).read_bytes()).hexdigest(),
        'crop': PANEL_CROP, 'size': base.size,
        'alphaSha256': hashlib.sha256(alpha).hexdigest(),
        'composition': 'Crop at native resolution; multiply each RGB channel by tint/255; preserve source alpha. No trim, rotation, scaling or extra border.',
        'colorStatus': 'Estimated from retained lossy WebPs. Exact game tint values and original encoder settings remain unconfirmed. Public panels are preserved byte-for-byte.',
        'panels': panels}

def reconstruct_panels(source, output):
    """Write comparison candidates to a separate review directory only."""
    output.mkdir(parents=True, exist_ok=True)
    base, recipe = panel_recipe(source, output)
    base.save(output/'source-panel.webp', 'WEBP', lossless=True, exact=True)
    for sin, (_, tint) in PANEL_TINTS.items():
        ImageChops.multiply(base, Image.new('RGBA', base.size, (*tint, 255))).save(
            output/f'{sin}.webp', 'WEBP', lossless=True, exact=True)
    (output/'recipe.json').write_text(json.dumps(recipe, indent=2)+'\n')

# Half-resolution measurement coordinates; the original atlases are 2048x2048.
CROPS = {
 'MainUI_Formation_9.png': {
  'common-frame/ego-frame-outer.webp': (0,0,261,262),
  'rank-banners/zayin.webp': (786,132,884,177),
  'rank-banners/teth.webp': (786,175,884,213),
  'rank-banners/he.webp': (786,214,884,254),
  'rank-banners/waw.webp': (891,131,990,173),
  'rank-banners/aleph.webp': (891,174,990,212),
 },
 'New_MainUI_Formation_3.png': {'common-frame/sinner-badge.webp': (543,11,674,141)},
 'MainUI_Formation_7.png': {
  'grade-symbols/grade-zayin-symbol.webp': (663,912,714,998),
  'grade-symbols/grade-teth-symbol.webp': (710,912,783,998),
  'grade-symbols/grade-he-symbol.webp': (780,912,852,998),
  'grade-symbols/grade-waw-symbol.webp': (849,912,889,998),
  'grade-symbols/grade-aleph-symbol.webp': (896,912,976,998),
 },
}

def extract(source, output):
    entries=[]
    for name, crops in CROPS.items():
        atlas=Image.open(source/name).convert('RGBA')
        if atlas.size != (2048,2048): raise ValueError(f'Unexpected atlas size: {name}')
        for key, rect in crops.items():
            bounds=tuple(x*2 for x in rect);im=atlas.crop(bounds);alpha=im.getchannel('A').getbbox()
            if alpha is None: raise ValueError(f'Empty crop: {key}')
            im=im.crop(alpha);target=output/key;target.parent.mkdir(parents=True,exist_ok=True)
            im.save(target,'WEBP',lossless=True,exact=True)
            entries.append({'file':key,'source':name,'sourceSha256':hashlib.sha256((source/name).read_bytes()).hexdigest(),
                'crop':bounds,'alphaBounds':alpha,'size':im.size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
    (output/'source.json').write_text(json.dumps({'sourceFolder':'https://drive.google.com/drive/folders/1Nk9WWMxEcovs5Ewku5ICT1PbfByNcV_z',
        'layers':['artwork','circular frame','sinner badge','sin panel','grade symbol','rank banner','interpretation numeral'],
        'entries':entries,
        'sinPanels':panel_recipe(source, output)[1],
        'unresolved':['Exact original sin-panel tint values and encoder settings remain unconfirmed; existing seven WebPs are preserved. No new Dante asset download.']},indent=2)+'\n')

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('source',type=Path);p.add_argument('output',type=Path)
    p.add_argument('--panels-only', action='store_true', help='Write estimated panel reconstructions to a separate review output directory')
    a=p.parse_args()
    if a.panels_only: reconstruct_panels(a.source,a.output)
    else: extract(a.source,a.output)
