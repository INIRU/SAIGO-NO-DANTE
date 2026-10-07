#!/usr/bin/env python3
"""Train the Assist gift-icon classifier on synthetic slots and score it on real, labelled slot crops.

Each synthetic sample is a real empty slot (dialog or wheel crop, 1.3x the app's slot region) with a catalog icon pasted at
the region's size, its grade numeral and keyword badge, then degraded like a shared screen: fading in, small captures,
JPEG, brightness, blur and a cursor. The five vestiges are one class (the app never tells them apart) and "blank" is one.

  python3 scripts/vision/train_icons.py --data <dir with icons/, badges/, bg/, real/, real.json, gifts.json> --out <dir>
      [--init-onnx <shipped icon-classifier.onnx> --init-labels <its icon-labels.json>] [--real-train <real-train.json>]
With --init-onnx the shipped model is kept and corrected with small steps: gifts added to the catalog since get a class,
and the scores of the gifts it already knows stay as the app's thresholds expect. Each epoch also reports how sure the model
is of another gift when the true one is taken away (an icon it does not know), at the app's logit scale.
--real-train adds labelled real crops ([{file, id}] in <data>/real, checked by eye) to every epoch: the gifts real captures
read weakly (dark drawings on the dark slot) are corrected from their own crops. --dark instead draws dark icons more often,
dims a third of all icons and labels 3% as blank ghosts (1-5% opacity, no ring); in 2026-10-07 trials it read the held-out
dark gifts but lowered another dark gift (9026) or a faded one, and was not shipped.
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
from torch.utils.data import ConcatDataset, DataLoader, Dataset
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
        # Sampling weight per class: up to 3x for the darkest icons (mean brightness of the opaque pixels), 1x for blank.
        def brightness(gid):
            pixels = np.asarray(self.icons[gid].resize((48, 48)), np.float32)
            opaque = pixels[..., 3] > 128
            return float(pixels[..., :3][opaque].mean()) if opaque.any() else 128.0
        self.weights = [1.0 if name == 'blank' else 1 + 2 * max(0.0, min(1.0, (110 - min(brightness(gid) for gid in self.members[name])) / 70))
                        for name in self.classes]


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


def synth(assets, label, rng, ghost=False, dark=False):
    slot = rng.choice(assets.backgrounds).copy()
    if rng.random() < 0.5:
        slot = slot.transpose(Image.FLIP_LEFT_RIGHT)
    if label != 'blank':
        gid = rng.choice(assets.members[label])
        gift = assets.gifts[gid]
        region = SIZE / 1.3
        layer = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
        # A ghost has no ring yet: the ring and numeral of a filled slot are what tell a dark icon from one fading in.
        if not ghost and rng.random() < 0.8:
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
        if dark and rng.random() < 0.3:
            icon = ImageEnhance.Brightness(icon).enhance(rng.uniform(0.45, 0.85))
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
        # Dialog slots fade in: the whole slot content at a fraction of its opacity. A ghost (the first moment of it) shows
        # too little to name: such a slot is trained as blank, or a dark icon would be read into it.
        if ghost:
            alpha = np.asarray(layer.getchannel('A'), np.float32) * rng.uniform(0.01, 0.05)
            layer.putalpha(Image.fromarray(alpha.astype(np.uint8)))
        elif rng.random() < 0.25:
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
    def __init__(self, assets, length, seed, dark=False):
        self.assets, self.length, self.seed, self.dark = assets, length, seed, dark

    def __len__(self):
        return self.length

    def __getitem__(self, index):
        rng = random.Random(self.seed * 1_000_003 + index)
        label = rng.choices(range(len(self.assets.classes)), self.assets.weights)[0] if self.dark else rng.randrange(len(self.assets.classes))
        ghost = self.dark and self.assets.classes[label] != 'blank' and rng.random() < 0.03
        image = synth(self.assets, self.assets.classes[label], rng, ghost, self.dark)
        return to_tensor(image), self.assets.classes.index('blank') if ghost else label


class RealCrops(Dataset):
    """Labelled real slot crops, each seen `repeat` times an epoch with the shared-screen damage of the synthetic ones."""
    def __init__(self, data, rows, classes, repeat, seed):
        index = {name: i for i, name in enumerate(classes)}
        self.items = [(Image.open(data / 'real' / row['file']).convert('RGB').resize((SIZE, SIZE)), index[group(row['id'])]) for row in rows if group(row['id']) in index]
        self.repeat, self.seed = repeat, seed

    def __len__(self):
        return len(self.items) * self.repeat

    def __getitem__(self, index):
        image, label = self.items[index % len(self.items)]
        return to_tensor(degrade(image, random.Random(self.seed * 7_919 + index))), label


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


LOGIT_SCALE = 1.5  # lib/vision/scene-worker.ts scales the logits by this before the softmax


def calibration(model, device, real, classes, data):
    """At the app's logit scale: slots it reads strongly (0.85, lead 0.25), and the top score left when the true class is removed."""
    index = {name: i for i, name in enumerate(classes)}
    rows = [row for row in real if group(row['id']) in index]
    batch = torch.stack([to_tensor(Image.open(data / 'real' / row['file']).convert('RGB').resize((SIZE, SIZE))) for row in rows])
    model.eval()
    with torch.no_grad():
        logits = model(batch.to(device)).cpu() * LOGIT_SCALE
    model.train()
    truth = torch.tensor([index[group(row['id'])] for row in rows])
    top = torch.softmax(logits, 1).topk(2, 1)
    strong = int(((top.indices[:, 0] == truth) & (top.values[:, 0] >= 0.85) & (top.values[:, 0] - top.values[:, 1] >= 0.25)).sum())
    logits[torch.arange(len(rows)), truth] = -1e9
    other = torch.softmax(logits, 1)
    other[:, index['blank']] = 0
    unknown = other.max(1).values
    return {'strong': strong, 'unknownMax': round(float(unknown.max()), 3), 'unknownOver0.6': int((unknown >= 0.6).sum())}


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
    parser.add_argument('--init-onnx', type=Path)
    parser.add_argument('--init-labels', type=Path)
    parser.add_argument('--real-train', type=Path)
    parser.add_argument('--real-repeat', type=int, default=60)
    parser.add_argument('--dark', action='store_true')
    args = parser.parse_args()
    torch.manual_seed(0)
    random.seed(0)
    assets = Assets(args.data, args.stages)
    real = json.load(open(args.data / 'real.json'))
    device = torch.device('mps' if torch.backends.mps.is_available() else 'cpu')
    if args.init_onnx:
        from train_scene import from_onnx
        known = json.load(open(args.init_labels))
        model = from_onnx(args.init_onnx, len(known))
        # Classes keep their rows; a gift the shipped model does not know starts from the average row.
        old, head = model.classifier[3], nn.Linear(model.classifier[3].in_features, len(assets.classes))
        with torch.no_grad():
            head.weight.copy_(old.weight.mean(0, keepdim=True).expand_as(head.weight))
            head.bias.fill_(float(old.bias.mean()))
            for row, name in enumerate(assets.classes):
                if name in known:
                    head.weight[row] = old.weight[known.index(name)]
                    head.bias[row] = old.bias[known.index(name)]
        model.classifier[3] = head
        model.train()
        print('started from', args.init_onnx, '| new classes', [name for name in assets.classes if name not in known], flush=True)
    else:
        model = models.mobilenet_v3_small(weights=models.MobileNet_V3_Small_Weights.DEFAULT)
        model.classifier[3] = nn.Linear(model.classifier[3].in_features, len(assets.classes))
    model.to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)
    real_train = json.load(open(args.real_train)) if args.real_train else []
    steps = args.epochs * math.ceil((args.per_epoch + len(real_train) * args.real_repeat) / args.batch)
    scheduler = torch.optim.lr_scheduler.OneCycleLR(optimizer, max_lr=1e-4 if args.init_onnx else 2e-3, total_steps=steps, pct_start=0.1)
    loss_fn = nn.CrossEntropyLoss(label_smoothing=0.1)
    args.out.mkdir(parents=True, exist_ok=True)
    print('classes', len(assets.classes), 'backgrounds', len(assets.backgrounds), 'real', len(real), 'device', device, flush=True)
    best, history = (-1, 0, 0.0), []
    # Held-out crops of the gifts real captures read weakly: reported apart, never used to pick the epoch.
    hard = [row for row in real if row['kind'] == 'hard']
    for epoch in range(args.epochs):
        started, total, count = time.time(), 0.0, 0
        samples = Synthetic(assets, args.per_epoch, epoch, args.dark)
        if args.real_train:
            samples = ConcatDataset([samples, RealCrops(args.data, real_train, assets.classes, args.real_repeat, epoch)])
        loader = DataLoader(samples, batch_size=args.batch, shuffle=bool(args.real_train), num_workers=args.workers, persistent_workers=False)
        for images, labels in loader:
            images, labels = images.to(device), labels.to(device)
            loss = loss_fn(model(images), labels)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            scheduler.step()
            total += loss.item() * len(labels)
            count += len(labels)
        rows = evaluate(model, device, real, assets.classes, args.data)
        score = summary(rows)
        history.append({'epoch': epoch, 'loss': total / count, 'real': score, 'calibration': calibration(model, device, [row for row in real if row['kind'] != 'hard'], assets.classes, args.data),
                        'hardStrong': calibration(model, device, hard, assets.classes, args.data)['strong'] if hard else None,
                        'seconds': round(time.time() - started)})
        print(json.dumps(history[-1], ensure_ascii=False), flush=True)
        # Chosen on the strong labels only (mid, hard and video rows stay held out); among equals, the epoch that is least
        # sure of another gift when the true one is taken away.
        rank = (score.get('strong', {}).get('top1', 0), -history[-1]['calibration']['unknownOver0.6'], -history[-1]['calibration']['unknownMax'])
        if rank >= best:
            best = rank
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
