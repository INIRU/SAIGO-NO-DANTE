#!/usr/bin/env python3
"""Train the Assist gift-icon classifier on synthetic slots and score it on real, labelled slot crops.

Each synthetic sample is a real empty slot (dialog or wheel crop, 1.3x the app's slot region) with a catalog icon pasted at
the region's size, its grade numeral and keyword badge, then degraded like a shared screen: fading in, small captures,
JPEG, brightness, blur and a cursor. The five vestiges are one class (the app never tells them apart) and "blank" is one.

  python3 scripts/vision/train_icons.py --data <dir with icons/, badges/, bg/, real/, real.json, gifts.json> --out <dir>
Writes <out>/icon-classifier.onnx, <out>/icon-labels.json and <out>/report.json. Assets: catalog icons of the site,
public/assets/ego-stages (grade numerals) and the site's keyword icons; slot backgrounds are crops of the maintainer's
captures and are not distributed.
"""
import argparse, io, json, math, random, time
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter
from torch import nn
from torch.utils.data import DataLoader, Dataset
from torchvision import models

SIZE = 96
VESTIGES = {'9991', '9992', '9993', '9994', '9995'}
GLYPH = {'1': (103, 32, 120, 158), '2': (82, 35, 140, 156), '3': (61, 32, 162, 159), '4': (45, 32, 181, 158), '5': (63, 35, 155, 158)}
KEYWORD = {'화상': 'burn', '출혈': 'bleed', '진동': 'tremor', '파열': 'rupture', '침잠': 'sinking', '호흡': 'breath', '충전': 'charge',
           '참격': 'slash', '관통': 'pierce', '타격': 'blunt'}
MEAN = np.array([0.485, 0.456, 0.406], np.float32)
STD = np.array([0.229, 0.224, 0.225], np.float32)


def group(gift_id):
    return '9991' if gift_id in VESTIGES else gift_id


class Assets:
    def __init__(self, data, stages):
        gifts = json.load(open(data / 'gifts.json'))
        self.gifts = {str(g['game_id']): g for g in gifts if (data / 'icons' / f"{g['game_id']}.webp").exists()}
        self.icons = {gid: Image.open(data / 'icons' / f'{gid}.webp').convert('RGBA') for gid in self.gifts}
        self.glyphs = {grade: Image.open(stages / f'{grade}.webp').convert('RGBA').crop((x0, y0, x1 + 1, y1 + 1))
                       for grade, (x0, y0, x1, y1) in GLYPH.items()}
        self.badges = {slug: Image.open(data / 'badges' / f'{slug}.webp').convert('RGBA') for slug in set(KEYWORD.values())}
        self.backgrounds = [Image.open(path).convert('RGB').resize((SIZE, SIZE)) for path in sorted((data / 'bg').glob('*/*.png'))]
        # The hazard-striped ring a filled slot shows around its octagon (the site's game slot background, hole cut out).
        self.ring = Image.open(data / 'ring.png').convert('RGBA')
        self.classes = sorted({group(gid) for gid in self.gifts}) + ['blank']
        # Each class draws from its members (the vestige class from all five bottles).
        self.members = {}
        for gid in self.gifts:
            self.members.setdefault(group(gid), []).append(gid)


def degrade(image, rng):
    """Shared-screen damage: a small capture scaled back up, JPEG, brightness/contrast, blur."""
    if rng.random() < 0.8:
        side = rng.randint(22, SIZE)
        image = image.resize((side, side), Image.BILINEAR).resize((SIZE, SIZE), Image.BILINEAR)
    if rng.random() < 0.3:
        image = image.filter(ImageFilter.GaussianBlur(rng.uniform(0.3, 1.2)))
    image = ImageEnhance.Brightness(image).enhance(rng.uniform(0.75, 1.2))
    image = ImageEnhance.Contrast(image).enhance(rng.uniform(0.8, 1.2))
    if rng.random() < 0.7:
        buffer = io.BytesIO()
        image.save(buffer, 'JPEG', quality=rng.randint(30, 92))
        image = Image.open(io.BytesIO(buffer.getvalue())).convert('RGB')
    return image


def synth(assets, label, rng):
    slot = rng.choice(assets.backgrounds).copy()
    if rng.random() < 0.5:
        slot = slot.transpose(Image.FLIP_LEFT_RIGHT)
    if label != 'blank':
        gid = rng.choice(assets.members[label])
        gift = assets.gifts[gid]
        region = SIZE / 1.3
        layer = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
        if rng.random() < 0.8:
            ring_side = int(round(SIZE * rng.uniform(1.0, 1.25)))
            ring = assets.ring.resize((ring_side, ring_side), Image.LANCZOS)
            alpha = np.asarray(ring.getchannel('A'), np.float32) * rng.uniform(0.45, 1.0)
            ring.putalpha(Image.fromarray(alpha.astype(np.uint8)))
            offset = int(round((SIZE - ring_side) / 2 + rng.gauss(0, 2)))
            base = slot.convert('RGBA')
            base.alpha_composite(ring, (offset, offset)) if offset >= 0 else base.paste(ring, (offset, offset), ring)
            slot = base.convert('RGB')
        side = int(round(region * rng.uniform(0.86, 1.14)))
        icon = assets.icons[gid].resize((side, side), Image.LANCZOS)
        shift = region * 0.06
        layer.alpha_composite(icon, (int(round((SIZE - side) / 2 + rng.gauss(0, shift))), int(round((SIZE - side) / 2 + rng.gauss(0, shift)))))
        edge = (SIZE - region) / 2
        grade = str(gift.get('grade'))
        if grade in assets.glyphs and rng.random() < 0.95:
            glyph = assets.glyphs[grade]
            height = max(4, int(round(SIZE * rng.uniform(0.22, 0.32))))
            width = max(1, int(round(glyph.width * height / glyph.height)))
            layer.alpha_composite(glyph.resize((width, height), Image.LANCZOS),
                                  (max(0, int(edge + region * rng.uniform(-0.2, 0.05))), max(0, int(edge + region * rng.uniform(-0.15, 0.05)))))
        slug = KEYWORD.get(gift.get('keyword'))
        if slug and rng.random() < 0.9:
            badge_side = max(4, int(round(SIZE * rng.uniform(0.2, 0.3))))
            x = int(SIZE - edge - badge_side + region * rng.uniform(-0.05, 0.25))
            y = int(SIZE - edge - badge_side + region * rng.uniform(-0.05, 0.25))
            layer.alpha_composite(assets.badges[slug].resize((badge_side, badge_side), Image.LANCZOS),
                                  (min(SIZE - badge_side, x), min(SIZE - badge_side, y)))
        # Dialog slots fade in: the whole slot content at a fraction of its opacity.
        if rng.random() < 0.25:
            alpha = np.asarray(layer.getchannel('A'), np.float32) * rng.uniform(0.2, 0.9)
            layer.putalpha(Image.fromarray(alpha.astype(np.uint8)))
        base = slot.convert('RGBA')
        base.alpha_composite(layer)
        slot = base.convert('RGB')
    if rng.random() < 0.08:
        # A cursor over the slot.
        draw = ImageDraw.Draw(slot)
        x, y = rng.uniform(10, SIZE - 20), rng.uniform(10, SIZE - 20)
        draw.polygon([(x, y), (x + 10, y + 16), (x + 3, y + 14)], fill=(235, 170, 40))
    return degrade(slot, rng)


def to_tensor(image):
    array = (np.asarray(image, np.float32) / 255 - MEAN) / STD
    return torch.from_numpy(array.transpose(2, 0, 1).copy())


class Synthetic(Dataset):
    def __init__(self, assets, length, seed):
        self.assets, self.length, self.seed = assets, length, seed

    def __len__(self):
        return self.length

    def __getitem__(self, index):
        rng = random.Random(self.seed * 1_000_003 + index)
        label = rng.randrange(len(self.assets.classes))
        return to_tensor(synth(self.assets, self.assets.classes[label], rng)), label


def evaluate(model, device, real, classes, data):
    model.eval()
    index = {name: i for i, name in enumerate(classes)}
    batch = torch.stack([to_tensor(Image.open(data / 'real' / row['file']).convert('RGB').resize((SIZE, SIZE))) for row in real])
    with torch.no_grad():
        probabilities = torch.softmax(model(batch.to(device)), 1).cpu().numpy()
    rows = []
    for row, p in zip(real, probabilities):
        order = np.argsort(-p)
        rows.append({**row, 'top': classes[order[0]], 'p': float(p[order[0]]), 'second': float(p[order[1]]),
                     'truthP': float(p[index[group(row['id'])]]) if group(row['id']) in index else 0.0})
    model.train()
    return rows


def summary(rows):
    out = {}
    for kind in sorted({row['kind'] for row in rows}):
        part = [row for row in rows if row['kind'] == kind]
        out[kind] = {'n': len(part), 'top1': sum(group(r['id']) == r['top'] for r in part)}
    out['all'] = {'n': len(rows), 'top1': sum(group(r['id']) == r['top'] for r in rows)}
    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--data', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--stages', type=Path, default=Path('public/assets/ego-stages'))
    parser.add_argument('--epochs', type=int, default=12)
    parser.add_argument('--per-epoch', type=int, default=48000)
    parser.add_argument('--batch', type=int, default=128)
    parser.add_argument('--workers', type=int, default=8)
    args = parser.parse_args()
    torch.manual_seed(0)
    random.seed(0)
    assets = Assets(args.data, args.stages)
    real = json.load(open(args.data / 'real.json'))
    device = torch.device('mps' if torch.backends.mps.is_available() else 'cpu')
    model = models.mobilenet_v3_small(weights=models.MobileNet_V3_Small_Weights.DEFAULT)
    model.classifier[3] = nn.Linear(model.classifier[3].in_features, len(assets.classes))
    model.to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)
    steps = args.epochs * math.ceil(args.per_epoch / args.batch)
    scheduler = torch.optim.lr_scheduler.OneCycleLR(optimizer, max_lr=2e-3, total_steps=steps, pct_start=0.1)
    loss_fn = nn.CrossEntropyLoss(label_smoothing=0.1)
    args.out.mkdir(parents=True, exist_ok=True)
    print('classes', len(assets.classes), 'backgrounds', len(assets.backgrounds), 'real', len(real), 'device', device, flush=True)
    best, history = -1, []
    for epoch in range(args.epochs):
        started, total = time.time(), 0.0
        loader = DataLoader(Synthetic(assets, args.per_epoch, epoch), batch_size=args.batch, shuffle=False,
                            num_workers=args.workers, persistent_workers=False)
        for images, labels in loader:
            images, labels = images.to(device), labels.to(device)
            loss = loss_fn(model(images), labels)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            scheduler.step()
            total += loss.item() * len(labels)
        rows = evaluate(model, device, real, assets.classes, args.data)
        score = summary(rows)
        history.append({'epoch': epoch, 'loss': total / args.per_epoch, 'real': score, 'seconds': round(time.time() - started)})
        print(json.dumps(history[-1], ensure_ascii=False), flush=True)
        # Chosen on the strong labels only; mid and video rows stay held out.
        if score.get('strong', {}).get('top1', 0) >= best:
            best = score.get('strong', {}).get('top1', 0)
            torch.save(model.state_dict(), args.out / 'best.pt')
            json.dump(rows, open(args.out / 'real-predictions.json', 'w'), ensure_ascii=False)
    model.load_state_dict(torch.load(args.out / 'best.pt', map_location=device))
    model.eval().cpu()
    torch.onnx.export(model, torch.zeros(1, 3, SIZE, SIZE), args.out / 'icon-classifier.onnx', input_names=['input'], output_names=['logits'],
                      dynamic_axes={'input': {0: 'batch'}, 'logits': {0: 'batch'}}, opset_version=17)
    json.dump(assets.classes, open(args.out / 'icon-labels.json', 'w'))
    json.dump({'history': history, 'classes': len(assets.classes), 'input': [SIZE, SIZE], 'crop': '1.3x the slot region',
               'mean': MEAN.tolist(), 'std': STD.tolist()}, open(args.out / 'report.json', 'w'), indent=1)


if __name__ == '__main__':
    main()
