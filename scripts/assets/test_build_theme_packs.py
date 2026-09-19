import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path
from PIL import Image

spec = importlib.util.spec_from_file_location("theme_composer", Path(__file__).with_name("build-theme-packs.py"))
composer = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = composer
spec.loader.exec_module(composer)


class ThemeCompositionTests(unittest.TestCase):
    def test_indexes_theme_sources_from_extracted_manifest(self):
        with tempfile.TemporaryDirectory() as root:
            root_path = Path(root)
            image_path = root_path / "Images" / "거울던전" / "테마팩" / "Azure_normal.png"
            image_path.parent.mkdir(parents=True)
            image_path.touch()
            reports = root_path / "Reports"
            reports.mkdir()
            (reports / "manifest.json").write_text(json.dumps([
                {"kind": "테마팩", "name": "Azure_normal", "path": "거울던전/테마팩/Azure_normal.png"},
                {"kind": "수감자", "name": "ignored", "path": "수감자/ignored.png"},
            ]), encoding="utf-8")
            previous = composer.EXTRACTED_ASSET_ROOT
            composer.EXTRACTED_ASSET_ROOT = root
            try:
                self.assertEqual(composer.build_image_index(), {"Azure_normal": image_path.resolve()})
                (reports / "manifest.json").write_text(json.dumps([
                    {"kind": "테마팩", "name": "Azure_normal", "path": "거울던전/테마팩/Azure_normal.png"},
                    {"kind": "테마팩보스", "name": "Azure_normal", "path": "거울던전/테마팩/Azure_normal.png"},
                ]), encoding="utf-8")
                with self.assertRaisesRegex(ValueError, "Duplicate theme image name"):
                    composer.build_image_index()
            finally:
                composer.EXTRACTED_ASSET_ROOT = previous

    def test_rejects_out_of_bounds_atlas_instead_of_padding_with_blank_pixels(self):
        with self.assertRaisesRegex(ValueError, "exceeds source size"):
            composer.crop_region(Image.new("RGBA", (100, 100)), (80, 0, 120, 100))

    def test_mask_clips_boss_and_background_to_pack_bounds(self):
        card = Image.new("RGBA", composer.CANVAS_SIZE, (50, 80, 90, 255))
        mask = Image.new("L", composer.NORMAL_PACK_SIZE, 255)
        mask.paste(0, (0, 0, 40, 690))
        result = composer.apply_mask(card, mask, composer.NORMAL_PACK_OFFSET)
        self.assertEqual(result.getpixel((30, 200))[3], 0)
        self.assertEqual(result.getpixel((100, 200))[3], 255)
        self.assertEqual(result.getpixel((410, 200))[3], 0)

    def test_alpha_order_and_final_canvas_size(self):
        base = Image.new("RGBA", (1, 1), (255, 0, 0, 255))
        overlay = Image.new("RGBA", (1, 1), (0, 0, 255, 128))
        self.assertEqual(composer.compose_layers(base, [None, overlay]).getpixel((0, 0)), (127, 0, 128, 255))
        self.assertEqual(composer.to_site_asset(Image.new("RGBA", composer.CANVAS_SIZE)).size, (416, 684))


if __name__ == "__main__":
    unittest.main()
