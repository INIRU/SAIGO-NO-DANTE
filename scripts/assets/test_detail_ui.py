"""Regression checks for clipped edges, atlas shards, color and native alignment."""
import json
import unittest
from pathlib import Path
from PIL import Image

ASSETS = Path(__file__).resolve().parents[2] / 'public/assets/game-ui'


class DetailUI(unittest.TestCase):
    def test_keyword_atlas_crops_keep_native_glow_and_distinct_shin(self):
        expected = {'tiantui-star': (16, 10, 108, 124), 'shin-tiantui-star': (13, 1, 116, 125),
                    'tremor-burst': (5, 1, 120, 127), 'shimmering-bloodfiend': (0, 3, 128, 125)}
        for name, bounds in expected.items():
            self.assertTrue((ASSETS / f'keywords/{name}.webp').exists(), name)
            image = Image.open(ASSETS / f'keywords/{name}.webp').convert('RGBA')
            self.assertEqual(image.size, (128, 128), name)
            self.assertEqual(image.getchannel('A').getbbox(), bounds, name)
        normal = Image.open(ASSETS / 'keywords/tiantui-star.webp').convert('RGBA')
        shin = Image.open(ASSETS / 'keywords/shin-tiantui-star.webp').convert('RGBA')
        self.assertNotEqual(normal.tobytes(), shin.tobytes())
    def test_blessings_preserve_native_sources_and_starlight_glow(self):
        records = {item['file']: item for item in json.loads((ASSETS / 'source.json').read_text())['outputs']}
        for number in range(100, 110):
            name = f'start-buffs/{number}.webp'
            record = records[name]
            self.assertEqual(record['drivePath'], f'icons/Mirror Dungeon/Mirror of the Dreaming/StartBuffIcon_{number}.png')
            self.assertIsNone(record['crop'])
            self.assertIsNone(record['canvas'])
            self.assertFalse(record['trim'])
            image = Image.open(ASSETS / name).convert('RGBA')
            self.assertEqual(list(image.getchannel('A').getbbox()), record['alphaBounds'])
        star = Image.open(ASSETS / 'start-buffs/starlight.webp').convert('RGBA')
        self.assertEqual(star.size, (256, 256))
        self.assertEqual(star.getchannel('A').getbbox(), (2, 1, 253, 255))
        self.assertEqual(records['start-buffs/starlight.webp']['driveId'], '15lolTXDC_8oi4TzM8QsZQJ-jY-jLcTPJ')

    def test_complete_stat_extents_and_padding(self):
        # Native connected-component extents, measured independently on the full atlas.
        expected = {'health': (127, 116), 'pierce': (128, 101), 'slash': (128, 109),
                    'defense': (122, 127), 'offense': (125, 127), 'speed': (120, 128), 'blunt': (128, 125)}
        for name, size in expected.items():
            image = Image.open(ASSETS / f'stats/{name}.webp').convert('RGBA')
            bounds = image.getchannel('A').getbbox()
            self.assertEqual((bounds[2]-bounds[0], bounds[3]-bounds[1]), size, name)
            self.assertGreaterEqual(min(bounds[0], bounds[1], 160-bounds[2], 160-bounds[3]), 16, name)
            self.assertLessEqual(abs((bounds[0]+bounds[2])/2-80), .5, name)

    def test_red_coin_and_rarity_order(self):
        def mean(name):
            pixels = [p for p in Image.open(ASSETS / name).convert('RGBA').getdata() if p[3] > 200 and max(p[:3]) > 60]
            return tuple(sum(p[i] for p in pixels)/len(pixels) for i in range(3))
        red = mean('coins/unbreakable.webp')
        self.assertGreater(red[0], red[1]*3)
        red_ring, gold_ring = mean('rarity/2.webp'), mean('rarity/3.webp')
        self.assertGreater(red_ring[0], red_ring[1]*2)
        self.assertGreater(gold_ring[1], red_ring[1]*2)

    def test_all_sinners_and_common_sin_canvas(self):
        self.assertEqual(len(list((ASSETS / 'sinners').glob('*.webp'))), 12)
        for path in (ASSETS / 'sins').glob('*.webp'):
            image = Image.open(path).convert('RGBA')
            self.assertEqual(image.size, (256,256))
            self.assertEqual(image.getpixel((0,0))[3], 0)
        self.assertEqual(len(json.loads((ASSETS / 'source.json').read_text())['outputs']), 52)


if __name__ == '__main__':
    unittest.main()
