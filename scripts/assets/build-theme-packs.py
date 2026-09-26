#!/usr/bin/env python3
from __future__ import annotations

import json
import hashlib
import os
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont


WORK_DIR = Path(os.environ.get("THEME_PACK_WORK_DIR", Path(__file__).resolve().parents[3] / "assets" / "theme-pack-build"))
DATA_DIR = Path(os.environ.get("LIMBUS_DATA_DIR", Path(__file__).resolve().parents[3] / "assets" / "data" / "Json (Text)"))
ASSET_ROOT = Path(os.environ.get("LIMBUS_THEME_ASSET_ROOT", "/Users/iniru/Downloads/Mirror Dungeon"))
EXTRACTED_ASSET_ROOT = os.environ.get("LIMBUS_EXTRACTED_ASSET_ROOT")
OUTPUT_DIR = WORK_DIR / "output"
BASE_OUTPUT_DIR = OUTPUT_DIR / "base"
LAYER_OUTPUT_DIR = OUTPUT_DIR / "layers"
BOSS_OUTPUT_DIR = OUTPUT_DIR / "boss"
BOSS_LAYER_OUTPUT_DIR = LAYER_OUTPUT_DIR / "boss"
DIAG_DIR = WORK_DIR / "diagnostics"
COMPOSITION_ASSET_DIR = Path(os.environ.get("LIMBUS_COMPOSITION_ASSET_DIR", WORK_DIR / "reference" / "composition_assets"))

FOLDER_ORDER = [
    "Mirror of Names and Spiders",
    "Mirror of Immortality",
    "Mirror of the Dreaming",
    "Mirror of the Wuthering",
    "Mirror of the Lake",
    "Mirror of Mirrors",
    "Mirror of the Beginning",
    "Intervallos",
]

CANVAS_SIZE = (420, 720)
SITE_IMAGE_SIZE = (416, 684)
NORMAL_PACK_OFFSET = (20, 15)
NORMAL_PACK_SIZE = (380, 690)
EXTREME_FRAME_OFFSET = (2, 18)
WARNING_OFFSET = (146, 68)
WARNING_SIZE = (127, 111)
BOSS_OFFSET = (30, 110)
CHAIN_LABEL_TEXT = "장기 전투"
CHAIN_LABEL_FONT = Path(os.environ.get("LIMBUS_CHAIN_FONT", Path(__file__).resolve().parents[2] / "public" / "fonts" / "SCDream5.woff2"))
CHAIN_LABEL_CENTER = (210, 206)
CHAIN_LABEL_FONT_SIZE = 20


@dataclass(frozen=True)
class ThemeItem:
    tier: str
    theme_id: int
    desc: str
    pack_sprite_id: str
    boss_sprite_id: str | None
    is_show_warning: bool
    is_show_baton: bool
    is_hide_logo: bool
    is_extreme: bool
    text_color: str | None


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def build_image_index() -> dict[str, Path]:
    index: dict[str, Path] = {}
    if EXTRACTED_ASSET_ROOT:
        extracted_root = Path(EXTRACTED_ASSET_ROOT)
        manifest_path = extracted_root / "Reports" / "manifest.json"
        if not manifest_path.is_file():
            raise FileNotFoundError(f"No extracted image manifest at {manifest_path}")
        images_root = (extracted_root / "Images").resolve()
        for entry in read_json(manifest_path):
            if entry.get("kind") not in {"테마팩", "테마팩보스"}:
                continue
            name = entry.get("name")
            relative_path = entry.get("path")
            if not isinstance(name, str) or not isinstance(relative_path, str):
                raise ValueError(f"Invalid theme image manifest entry: {entry}")
            path = (images_root / relative_path).resolve()
            if images_root not in path.parents:
                raise ValueError(f"Theme image manifest path escapes Images: {relative_path}")
            if not path.is_file():
                raise FileNotFoundError(f"Theme image manifest source is missing: {path}")
            if name in index:
                raise ValueError(f"Duplicate theme image name in extracted manifest: {name}")
            index[name] = path
        return index

    for folder_name in FOLDER_ORDER:
        folder = ASSET_ROOT / folder_name
        if not folder.exists():
            continue
        for path in sorted(folder.iterdir()):
            if path.is_file() and path.suffix.lower() in {".png", ".webp", ".jpg", ".jpeg"}:
                index.setdefault(path.stem, path)
    return index


def load_theme_items() -> list[ThemeItem]:
    items: list[ThemeItem] = []
    paths = sorted(DATA_DIR.glob("mirrordungeon-theme-floor-t*.txt"))
    if not paths:
        raise FileNotFoundError(f"No theme floor data under {DATA_DIR}")
    paths.append(DATA_DIR / "mirrordungeon-theme-floor-hidden.txt")

    for path in paths:
        tier = path.stem.rsplit("-", 1)[-1]
        for entry in read_json(path).get("list", []):
            ui = entry.get("uiConfigs", {})
            pack = ui.get("packSpriteId")
            if not pack:
                continue
            items.append(
                ThemeItem(
                    tier=tier,
                    theme_id=int(entry["id"]),
                    desc=entry.get("desc", ""),
                    pack_sprite_id=pack,
                    boss_sprite_id=ui.get("bossSpriteId"),
                    is_show_warning=bool(ui.get("isShowWarning")),
                    is_show_baton=bool(ui.get("isShowBaton")),
                    is_hide_logo=bool(ui.get("isHideLogo")),
                    is_extreme=pack.endswith("_Extreme"),
                    text_color=ui.get("textColor"),
                )
            )
    return items


def rgba(path: Path) -> Image.Image:
    return Image.open(path).convert("RGBA")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def crop_region(sheet: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    left, top, right, bottom = box
    if not (0 <= left < right <= sheet.width and 0 <= top < bottom <= sheet.height):
        raise ValueError(f"Atlas crop {box} exceeds source size {sheet.size}")
    return sheet.crop(box)


def layer_canvas(asset: Image.Image, offset: tuple[int, int], size: tuple[int, int] = CANVAS_SIZE) -> Image.Image:
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    canvas.alpha_composite(asset, offset)
    return canvas


def fit_asset(asset: Image.Image, size: tuple[int, int]) -> Image.Image:
    if asset.size == size:
        return asset
    return asset.resize(size, Image.Resampling.LANCZOS)


def load_font(path: Path, size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    try:
        return ImageFont.truetype(str(path), size=size)
    except OSError as error:
        raise ValueError(f"Required Korean font could not be loaded: {path}") from error


def draw_chain_label(layer: Image.Image) -> Image.Image:
    label_layer = layer.copy()
    draw = ImageDraw.Draw(label_layer)
    font = load_font(CHAIN_LABEL_FONT, CHAIN_LABEL_FONT_SIZE)
    bbox = draw.textbbox((0, 0), CHAIN_LABEL_TEXT, font=font, stroke_width=1)
    width = bbox[2] - bbox[0]
    height = bbox[3] - bbox[1]
    x = CHAIN_LABEL_CENTER[0] - width // 2
    y = CHAIN_LABEL_CENTER[1] - height // 2

    for offset, fill in [
        ((0, 2), (0, 0, 0, 210)),
        ((0, 0), (95, 244, 230, 255)),
    ]:
        draw.text(
            (x + offset[0], y + offset[1]),
            CHAIN_LABEL_TEXT,
            font=font,
            fill=fill,
            stroke_width=1,
            stroke_fill=(0, 35, 32, 220),
        )

    return label_layer


def to_site_asset(card: Image.Image) -> Image.Image:
    return fit_asset(card, SITE_IMAGE_SIZE)


def load_normal_assets() -> tuple[Image.Image, Image.Image, Image.Image, Image.Image, Image.Image]:
    sheet = rgba(COMPOSITION_ASSET_DIR / "MainUI_MirrorDungeon4_4.png")
    vinyl_visual = crop_region(sheet, (919, 245, 1297, 906)).resize(NORMAL_PACK_SIZE, Image.Resampling.LANCZOS)
    vinyl_mask = (
        crop_region(sheet, (1318, 241, 1697, 920))
        .getchannel("A")
        .resize(NORMAL_PACK_SIZE, Image.Resampling.LANCZOS)
        .point(lambda v: 255 if v > 0 else 0)
    )
    warning = crop_region(sheet, (1775, 28, 2024, 246)).resize(WARNING_SIZE, Image.Resampling.LANCZOS)
    limbus_logo = crop_region(sheet, (1736, 269, 1982, 393)).resize((123, 62), Image.Resampling.LANCZOS)
    baton = rgba(COMPOSITION_ASSET_DIR / "Baton.png")
    return vinyl_visual, vinyl_mask, warning, limbus_logo, baton


def load_extreme_frame() -> Image.Image:
    sheet = rgba(COMPOSITION_ASSET_DIR / "MainUI_MirrorDungeon6_17.png")
    return crop_region(sheet, (0, 16, 701, 1248)).resize((416, 684), Image.Resampling.LANCZOS)


def apply_mask(card: Image.Image, mask: Image.Image, offset: tuple[int, int]) -> Image.Image:
    full_mask = Image.new("L", card.size, 0)
    full_mask.paste(mask, offset)
    r, g, b, a = card.split()
    return Image.merge("RGBA", (r, g, b, ImageChops.multiply(a, full_mask)))


def compose_normal_base(
    pack_path: Path,
    *,
    vinyl_mask: Image.Image,
) -> Image.Image:
    card = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
    card.alpha_composite(fit_asset(rgba(pack_path), NORMAL_PACK_SIZE), NORMAL_PACK_OFFSET)
    return apply_mask(card, vinyl_mask, NORMAL_PACK_OFFSET)


def compose_extreme_base(pack_path: Path) -> Image.Image:
    card = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
    card.alpha_composite(rgba(pack_path), (53, 46))
    return card


def compose_normal_card(
    pack_path: Path,
    *,
    vinyl_visual: Image.Image,
    vinyl_mask: Image.Image,
    boss_path: Path | None,
    limbus_logo: Image.Image | None,
    warning: Image.Image | None,
    baton_layer: Image.Image | None,
) -> tuple[Image.Image, Image.Image | None]:
    content = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
    content.alpha_composite(fit_asset(rgba(pack_path), NORMAL_PACK_SIZE), NORMAL_PACK_OFFSET)

    boss_layer = None
    if boss_path is not None:
        boss_layer = layer_canvas(rgba(boss_path), BOSS_OFFSET)
        content.alpha_composite(boss_layer, (0, 0))

    if limbus_logo is not None:
        content.alpha_composite(layer_canvas(limbus_logo, (150, 477)), (0, 0))
    if warning is not None:
        content.alpha_composite(layer_canvas(warning, WARNING_OFFSET), (0, 0))
    if baton_layer is not None:
        content.alpha_composite(baton_layer, (0, 0))

    clipped = apply_mask(content, vinyl_mask, NORMAL_PACK_OFFSET)
    clipped.alpha_composite(layer_canvas(vinyl_visual, NORMAL_PACK_OFFSET), (0, 0))
    return clipped, boss_layer


def compose_layers(base: Image.Image, layers: list[Image.Image | None]) -> Image.Image:
    card = base.copy()
    for layer in layers:
        if layer is not None:
            card.alpha_composite(layer, (0, 0))
    return card


def main() -> None:
    DIAG_DIR.mkdir(parents=True, exist_ok=True)

    if OUTPUT_DIR.exists() and any(OUTPUT_DIR.iterdir()):
        raise FileExistsError(f"Output is not empty; choose a new THEME_PACK_WORK_DIR: {OUTPUT_DIR}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    BASE_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    LAYER_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    BOSS_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    BOSS_LAYER_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    index = build_image_index()
    items = load_theme_items()
    vinyl_visual, vinyl_mask, warning, limbus_logo, baton = load_normal_assets()
    extreme_frame = load_extreme_frame()
    layer_vinyl = layer_canvas(vinyl_visual, NORMAL_PACK_OFFSET)
    layer_warning = layer_canvas(warning, WARNING_OFFSET)
    layer_logo = layer_canvas(limbus_logo, (150, 477))
    layer_baton = draw_chain_label(layer_canvas(baton, (-18, 82)))
    layer_extreme_frame = layer_canvas(extreme_frame, EXTREME_FRAME_OFFSET)

    layer_vinyl.save(LAYER_OUTPUT_DIR / "vinyl.webp", "WEBP", quality=95, method=6)
    layer_warning.save(LAYER_OUTPUT_DIR / "warning.webp", "WEBP", quality=95, method=6)
    layer_logo.save(LAYER_OUTPUT_DIR / "limbus-logo.webp", "WEBP", quality=95, method=6)
    layer_baton.save(LAYER_OUTPUT_DIR / "baton.webp", "WEBP", quality=95, method=6)
    layer_extreme_frame.save(LAYER_OUTPUT_DIR / "extreme-frame.webp", "WEBP", quality=95, method=6)

    manifest = []
    text_colors = {}
    missing = []
    boss_sources: dict[str, Path] = {}

    for item in items:
        pack_path = index.get(item.pack_sprite_id)
        boss_path = index.get(item.boss_sprite_id) if item.boss_sprite_id else None
        out_path = OUTPUT_DIR / f"{item.theme_id}.webp"
        if item.text_color:
            text_colors[str(item.theme_id)] = f"#{item.text_color.upper()}"

        if pack_path is None:
            missing.append(
                {
                    "id": item.theme_id,
                    "desc": item.desc,
                    "packSpriteId": item.pack_sprite_id,
                    "reason": "pack source not found in downloaded folders",
                }
            )
            continue

        if item.boss_sprite_id and boss_path is None:
            missing.append(
                {
                    "id": item.theme_id,
                    "desc": item.desc,
                    "packSpriteId": item.pack_sprite_id,
                    "bossSpriteId": item.boss_sprite_id,
                    "reason": "boss source not found in downloaded folders",
                }
            )
            continue

        if item.is_extreme:
            base = compose_extreme_base(pack_path)
            composed = compose_layers(base, [layer_baton if item.is_show_baton else None, layer_extreme_frame])
        elif item.theme_id == 3001:
            base = rgba(pack_path)
            composed = base
        else:
            base = compose_normal_base(
                pack_path,
                vinyl_mask=vinyl_mask,
            )
            composed, boss_layer = compose_normal_card(
                pack_path,
                vinyl_visual=vinyl_visual,
                vinyl_mask=vinyl_mask,
                boss_path=boss_path if item.boss_sprite_id else None,
                limbus_logo=None if item.is_hide_logo else limbus_logo,
                warning=warning if item.is_show_warning else None,
                baton_layer=layer_baton if item.is_show_baton else None,
            )
            if item.boss_sprite_id and boss_path is not None and boss_layer is not None:
                boss_sources[item.boss_sprite_id] = boss_path
                boss_layer.save(BOSS_LAYER_OUTPUT_DIR / f"{item.boss_sprite_id}.webp", "WEBP", quality=95, method=6)

        if item.theme_id != 3001:
            base.save(BASE_OUTPUT_DIR / f"{item.theme_id}.webp", "WEBP", quality=95, method=6)
        site_asset = to_site_asset(composed)
        site_asset.save(out_path, "WEBP", quality=95, method=6)
        if item.theme_id == 3001:
            site_asset.save(OUTPUT_DIR / "HiddenTheme.webp", "WEBP", quality=95, method=6)
        manifest.append(
            {
                "id": item.theme_id,
                "desc": item.desc,
                "packSpriteId": item.pack_sprite_id,
                "bossSpriteId": item.boss_sprite_id,
                "textColor": f"#{item.text_color.upper()}" if item.text_color else None,
                "isShowWarning": item.is_show_warning,
                "isShowBaton": item.is_show_baton,
                "isHideLogo": item.is_hide_logo,
                "isExtreme": item.is_extreme,
                "output": str(out_path),
                "baseOutput": str(BASE_OUTPUT_DIR / f"{item.theme_id}.webp") if item.theme_id != 3001 else None,
                "source": str(pack_path),
                "bossSource": str(boss_path) if boss_path else None,
                "sourceSha256": sha256(pack_path),
                "bossSourceSha256": sha256(boss_path) if boss_path else None,
            }
        )

    for boss_id, boss_path in sorted(boss_sources.items()):
        rgba(boss_path).save(BOSS_OUTPUT_DIR / f"{boss_id}.webp", "WEBP", quality=95, method=6)

    (DIAG_DIR / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (DIAG_DIR / "missing.json").write_text(
        json.dumps(missing, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (DIAG_DIR / "theme_name_colors.json").write_text(
        json.dumps(text_colors, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    shared_sources = [COMPOSITION_ASSET_DIR / name for name in (
        "MainUI_MirrorDungeon4_4.png", "MainUI_MirrorDungeon6_17.png", "Baton.png"
    )] + [CHAIN_LABEL_FONT, Path(__file__)] + sorted(DATA_DIR.glob("mirrordungeon-theme-floor-*.txt"))
    (DIAG_DIR / "sources.json").write_text(json.dumps(
        [{"path": str(path), "sha256": sha256(path)} for path in shared_sources], indent=2
    ), encoding="utf-8")

    print(f"generated={len(list(OUTPUT_DIR.glob('*.webp')))}")
    print(f"base={len(list(BASE_OUTPUT_DIR.glob('*.webp')))} layers={len(list(LAYER_OUTPUT_DIR.glob('*.webp')))}")
    print(f"boss={len(list(BOSS_OUTPUT_DIR.glob('*.webp')))} boss_layers={len(list(BOSS_LAYER_OUTPUT_DIR.glob('*.webp')))}")
    print(f"manifest={DIAG_DIR / 'manifest.json'}")
    print(f"text_colors={DIAG_DIR / 'theme_name_colors.json'}")
    print(f"missing={len(missing)}")
    if missing:
        raise SystemExit("Incomplete source assets; see diagnostics/missing.json. Nothing was uploaded.")


if __name__ == "__main__":
    main()
