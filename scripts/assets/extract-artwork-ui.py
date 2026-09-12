#!/usr/bin/env python3
"""Extract UI sprites from the user's Drive atlases, preserving their alpha.

Rectangles are top-left pixel coordinates, inspected against the source sheets.
No network access; output manifest records source hashes and exact crops.
"""
import hashlib
import json
import sys
from pathlib import Path
from PIL import Image

SINNERS = ['yi-sang', 'faust', 'don-quixote', 'ryoshu', 'meursault', 'hong-lu', 'heathcliff', 'ishmael', 'rodion', 'sinclair', 'outis', 'gregor']

def extract(base):
    source = base / 'ui-originals'
    output = base / 'artwork-ui'
    records = []
    def crop(sheet, key, box, trim=True):
        image = Image.open(source / (sheet + '.png')).convert('RGBA')
        if not (0 <= box[0] < box[2] <= image.width and 0 <= box[1] < box[3] <= image.height):
            raise ValueError(f'Invalid crop: {sheet} {box}')
        result = image.crop(box)
        bounds = result.getchannel('A').getbbox()
        if bounds is None:
            raise ValueError(f'Empty sprite: {key}')
        if trim:
            result = result.crop(bounds)
        target = output / key
        target.parent.mkdir(parents=True, exist_ok=True)
        result.save(target, 'WEBP', lossless=True, exact=True)
        records.append({'key': key, 'local': str(target), 'sourceId': sheet,
                        'sourceSha256': hashlib.sha256((source / (sheet + '.png')).read_bytes()).hexdigest(),
                        'crop': box, 'alphaBounds': bounds, 'width': result.width, 'height': result.height,
                        'sha256': hashlib.sha256(target.read_bytes()).hexdigest()})
    for i, sinner in enumerate(SINNERS):
        x, y = (i % 4) * 512, (i // 4) * 512
        crop('MainUI_Logoicon', f'icons/Sinners/{sinner}.webp', (x, y, x + 512, y + 512))
    # White attack types occupy 256px atlas cells.
    for name, col, row in [('slash',0,0),('pierce',1,0),('defense',2,0),('counter',3,0),('blunt',0,1),('evade',1,1)]:
        crop('Icon_AttackType', f'icons/stats/{name}.webp', (col*256,row*256,(col+1)*256,(row+1)*256))
    # All following rectangles measured on a 1024px preview of the 2048px atlas.
    sheets = {
      'MainUI_PersonalityList_3': {
        'icons/grade/ZAYIN.webp': (465,389,563,425), 'icons/grade/TETH.webp': (466,425,563,463),
        'icons/grade/HE.webp': (526,459,624,493), 'icons/grade/WAW.webp': (257,599,354,640),
        'icons/grade/ALEPH.webp': (355,599,452,640), 'icons/ui/lock.webp': (711,0,812,128),
      },
      'MainUI_EGOSelectionPopup_02': {
        'icons/grade/banner-ZAYIN.webp': (8,209,112,251), 'icons/grade/banner-TETH.webp': (124,209,225,251),
        'icons/grade/banner-HE.webp': (239,209,343,251), 'icons/grade/banner-WAW.webp': (8,272,112,315),
        'icons/grade/banner-ALEPH.webp': (122,272,225,315),
      },
      'MainUI_PersonalityList_7': {
        'icons/Rarity/1star.webp': (277,126,367,256), 'icons/Rarity/2star.webp': (371,126,526,258),
        'icons/Rarity/3star.webp': (532,126,766,258),
      },
      'MainUI_PersonalityList_4': {
        'icons/stats/health.webp': (704,522,770,589), 'icons/stats/speed.webp': (636,590,704,655),
        'icons/ui/icon-defense.webp': (766,522,834,589), 'icons/ui/icon-sword.webp': (904,522,974,589),
      },
      'MainUI_PersonalityList_8': {
        'icons/ui/portrait-frame-1star.webp': (0,875,128,1008),
        'icons/ui/portrait-frame-2star.webp': (132,875,263,1008),
        'icons/ui/portrait-frame-3star.webp': (266,875,396,1008),
        'icons/Rarity/0_frame.webp': (0,875,128,1008),
        'icons/Rarity/00_frame.webp': (132,875,263,1008),
        'icons/Rarity/000_frame.webp': (266,875,396,1008),
        'icons/ui/identity-selected-banner.webp': (739,74,994,136),
        'icons/ui/identity-backup-banner.webp': (524,346,798,403),
      },
    }
    for sheet, sprites in sheets.items():
        for key, rect in sprites.items():
            crop(sheet, key, tuple(v * 2 for v in rect))
    # Normal and red unbreakable coin faces occupy separate 256px cells.
    crop('BattleUI_NewCoin', 'icons/stats/coin.webp', (0,0,256,256))
    crop('BattleUI_NewCoin', 'icons/stats/unbreakable_coin.webp', (768,0,1024,256))
    crop('textIcons_1', 'icons/stats/panic.webp', (0,0,128,128))
    crop('textIcons_1', 'icons/stats/sanity_increase_bg.webp', (256,0,384,128))
    crop('textIcons_1', 'icons/stats/sanity_decrease_bg.webp', (0,0,128,128))
    (output / 'manifest.json').write_text(json.dumps(records, indent=2))
    print(json.dumps({'extracted':len(records),'output':str(output)}))

if __name__ == '__main__':
    extract(Path(sys.argv[1]).resolve())
