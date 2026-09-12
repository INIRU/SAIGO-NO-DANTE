"""Extract 3 rarities x 4 uptie frames from the user's original formation atlas."""
import argparse, hashlib, json
from pathlib import Path
from PIL import Image

# The first three rows are bronze/red/gold; the fourth row contains their IV frames.
# Coordinates are native pixels on the 2048-square export, top-left origin.
CELLS = {
  1: [(24, 24, 360, 484), (378, 0, 720, 484), (728, 14, 1072, 484), (24, 1484, 360, 1956)],
  2: [(24, 504, 360, 968), (378, 482, 720, 968), (728, 498, 1072, 968), (378, 1484, 720, 1956)],
  3: [(24, 986, 360, 1460), (378, 968, 720, 1460), (728, 980, 1072, 1460), (728, 1484, 1072, 1956)],
}

def extract(source, output):
    atlas = Image.open(source).convert('RGBA')
    if atlas.size != (2048, 2048): raise ValueError('Unexpected atlas dimensions')
    output.mkdir(parents=True, exist_ok=True)
    entries = []
    for rarity, regions in CELLS.items():
        for stage, bounds in enumerate(regions, 1):
            sprite = atlas.crop(bounds)
            alpha = sprite.getchannel('A').getbbox()
            if alpha is None: raise ValueError('Empty frame')
            sprite = sprite.crop(alpha)
            target = output / f'{rarity}star' / f'{stage}.webp'
            target.parent.mkdir(exist_ok=True)
            sprite.save(target, 'WEBP', lossless=True, exact=True)
            if stage == 4: (output / f'{rarity}star.webp').write_bytes(target.read_bytes())
            entries.append({'rarity':rarity,'stage':stage,'crop':bounds,'alphaBounds':alpha,
                'size':sprite.size,'file':str(target.relative_to(output)),
                'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
    (output / 'source.json').write_text(json.dumps({'source':source.name,
        'sourceFolder':'https://drive.google.com/drive/folders/1Nk9WWMxEcovs5Ewku5ICT1PbfByNcV_z',
        'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'entries':entries}, indent=2)+'\n')

if __name__ == '__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('source',type=Path);p.add_argument('output',type=Path)
    a=p.parse_args();extract(a.source,a.output)
