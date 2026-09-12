"""Guard against adjacent atlas fragments leaking into E.G.O grade layers."""
from collections import deque
from pathlib import Path
import unittest
import hashlib
import json
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]/'public/assets/ego-ui'
class GradeCropTest(unittest.TestCase):
    def test_all_seven_retained_panels_match_source_alpha_and_hashes(self):
        recipe = json.loads((ROOT/'source.json').read_text())['sinPanels']
        self.assertEqual(recipe['crop'], [1690, 908, 2048, 1063])
        self.assertEqual({p['sin'] for p in recipe['panels']},
                         {'wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy'})
        for panel in recipe['panels']:
            path = ROOT/panel['file']
            with Image.open(path) as im:
                self.assertEqual(im.size, (358, 155))
                self.assertEqual(hashlib.sha256(im.getchannel('A').tobytes()).hexdigest(), recipe['alphaSha256'])
            self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), panel['retainedSha256'])

    def test_waw_glyph_excludes_neighbor_glow(self):
        with Image.open(ROOT/'grade-symbols/grade-waw-symbol.webp') as im: self.assertEqual(im.size,(71,138))
        with Image.open(ROOT/'grade-symbols/grade-aleph-symbol.webp') as im: self.assertEqual(im.size,(137,136))

    def test_rank_banners_have_no_detached_neighbor_fragments(self):
        for name in ['zayin','teth','he','waw','aleph']:
            im=Image.open(ROOT/f'rank-banners/{name}.webp').getchannel('A')
            w,h=im.size;p=im.load();seen=set();components=[]
            for y in range(h):
                for x in range(w):
                    if p[x,y]<16 or (x,y) in seen:continue
                    queue=deque([(x,y)]);seen.add((x,y));count=0
                    while queue:
                        u,v=queue.popleft();count+=1
                        for nx,ny in [(u-1,v),(u+1,v),(u,v-1),(u,v+1)]:
                            if 0<=nx<w and 0<=ny<h and (nx,ny) not in seen and p[nx,ny]>=16:
                                seen.add((nx,ny));queue.append((nx,ny))
                    if count>16:components.append(count)
            self.assertEqual(len(components),1,name)

if __name__=='__main__':unittest.main()
