"""Regression check for the packed S3 silhouette cells in the source atlas."""
import json
import unittest
from pathlib import Path


class SkillFrameTests(unittest.TestCase):
    def test_s3_silhouettes_follow_their_sin_not_the_next_cell(self):
        root = Path(__file__).resolve().parents[2]
        manifest = json.loads((root / 'public/assets/skill-frames/manifest.json').read_text())
        outputs = {row['file']: row for row in manifest['outputs']}
        for sin, (column, row) in zip(
            ('wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy'),
            ((3, 1), (0, 2), (1, 2), (2, 2), (3, 2), (0, 3), (1, 3)),
        ):
            with self.subTest(sin=sin):
                asset = outputs[f'{sin}-3-base.webp']
                self.assertEqual(asset['source'], 'Icon_skillFrame_Invert.png')
                self.assertEqual(asset['crop'], [column * 512, row * 512, (column + 1) * 512, (row + 1) * 512])


if __name__ == '__main__':
    unittest.main()
