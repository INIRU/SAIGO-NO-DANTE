"""Regression: wide IV must keep the same visible height as narrow numerals."""
import importlib.util
import unittest
from pathlib import Path
from PIL import Image

spec = importlib.util.spec_from_file_location('ego_stages', Path(__file__).with_name('extract-ego-stages.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class NumeralScaleTest(unittest.TestCase):
    def test_wide_glyph_is_not_shrunk_to_fit_width(self):
        for width in (49, 93, 151, 201, 159):
            canvas, _ = module.normalize_numeral(Image.new('RGBA', (width, 178), 'white'))
            core = canvas.getchannel('A').point(lambda a: 255 if a >= 224 else 0).getbbox()
            self.assertEqual(core[3] - core[1], 128)
            self.assertEqual(canvas.size, (224, 192))

    def test_shipped_numerals_have_equal_visible_height(self):
        root = Path(__file__).resolve().parents[2] / 'public/assets/ego-stages'
        for level in range(1, 6):
            im = Image.open(root / f'{level}.webp').convert('RGBA')
            core = im.getchannel('A').point(lambda a: 255 if a >= 224 else 0).getbbox()
            # LANCZOS interpolation can move a threshold edge by one pixel.
            self.assertLessEqual(abs(core[3] - core[1] - 128), 1)
            self.assertEqual(im.size, (224, 192))

if __name__ == '__main__':
    unittest.main()
