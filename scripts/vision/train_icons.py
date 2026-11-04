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
read weakly (dark drawings on the dark slot) are corrected from their own crops. --arch mnv4s trains timm MobileNetV4-Conv-Small
(the shipped model since 2026-11-04b); --init-pt continues such a run, with another --seed so its synthetic slots are new.
The last epoch is exported (the schedule ends with tiny steps); the held-out real crops are scored every epoch and never
used to pick one, so the numbers reported for them are not chosen on them.
Writes <out>/icon-classifier.onnx (checked against PyTorch), <out>/icon-labels.json and <out>/report.json. Assets: catalog icons of the site,
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

from assist_common import ICON_SIZE as SIZE, IMAGENET_MEAN as MEAN, IMAGENET_STD as STD, LOGIT_SCALE, STRONG_LEAD, STRONG_P, export_onnx, from_onnx, group, mnv4s

GLYPH = {'1': (103, 32, 120, 158), '2': (82, 35, 140, 156), '3': (61, 32, 162, 159), '4': (45, 32, 181, 158), '5': (63, 35, 155, 158)}
KEYWORD = {'화상': 'burn', '출혈': 'bleed', '진동': 'tremor', '파열': 'rupture', '침잠': 'sinking', '호흡': 'breath', '충전': 'charge',
           '참격': 'slash', '관통': 'pierce', '타격': 'blunt'}

class Assets:
    def __init__(self, data, stages):
        gifts = json.load(open(data / 'gifts.json', encoding='utf-8'))
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
    strong = int(((top.indices[:, 0] == truth) & (top.values[:, 0] >= STRONG_P) & (top.values[:, 0] - top.values[:, 1] >= STRONG_LEAD)).sum())
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
    parser.add_argument('--seed', type=int, default=0, help='synthetic slots and their damage; give a continued run (--init-pt) another one')
    parser.add_argument('--init-pt', type=Path, help='with --arch mnv4s: start from this state dict (a best.pt of an earlier run, same classes)')
    parser.add_argument('--arch', choices=('mnv3s', 'mnv4s'), default='mnv3s',
                        help='mnv4s: timm MobileNetV4-Conv-Small (ImageNet, e2400 r224) trained from ImageNet (no --init-onnx)')
    args = parser.parse_args()
    torch.manual_seed(args.seed)
    random.seed(args.seed)
    assets = Assets(args.data, args.stages)
    real = json.load(open(args.data / 'real.json', encoding='utf-8'))
    device = torch.device('cuda' if torch.cuda.is_available() else 'mps' if torch.backends.mps.is_available() else 'cpu')
    if args.arch == 'mnv4s':
        if args.init_onnx:
            parser.error('--init-onnx rebuilds a MobileNetV3 model; continue a MobileNetV4 run with --init-pt')
        model = mnv4s(len(assets.classes), pretrained=not args.init_pt)
        if args.init_pt:
            model.load_state_dict(torch.load(args.init_pt, map_location='cpu'))
            print('started from', args.init_pt, flush=True)
    elif args.init_onnx:
        known = json.load(open(args.init_labels, encoding='utf-8'))
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
    real_train = json.load(open(args.real_train, encoding='utf-8')) if args.real_train else []
    steps = args.epochs * math.ceil((args.per_epoch + len(real_train) * args.real_repeat) / args.batch)
    scheduler = torch.optim.lr_scheduler.OneCycleLR(optimizer, max_lr=1e-4 if args.init_onnx or args.init_pt else 2e-3, total_steps=steps, pct_start=0.1)
    loss_fn = nn.CrossEntropyLoss(label_smoothing=0.1)
    args.out.mkdir(parents=True, exist_ok=True)
    print('classes', len(assets.classes), 'backgrounds', len(assets.backgrounds), 'real', len(real), 'device', device, flush=True)
    history = []
    for epoch in range(args.epochs):
        started, total, count = time.time(), 0.0, 0
        seed = args.seed * 1000 + epoch
        samples = Synthetic(assets, args.per_epoch, seed)
        if args.real_train:
            samples = ConcatDataset([samples, RealCrops(args.data, real_train, assets.classes, args.real_repeat, seed)])
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
        history.append({'epoch': epoch, 'loss': total / count, 'real': score, 'calibration': calibration(model, device, real, assets.classes, args.data),
                        'seconds': round(time.time() - started)})
        print(json.dumps(history[-1], ensure_ascii=False), flush=True)
    # the last epoch, kept as is (best.pt keeps its old name: --init-pt continues from it)
    torch.save(model.state_dict(), args.out / 'best.pt')
    json.dump(rows, open(args.out / 'real-predictions.json', 'w', encoding='utf-8'), ensure_ascii=False)
    sample = torch.stack([to_tensor(Image.open(args.data / 'real' / row['file']).convert('RGB').resize((SIZE, SIZE))) for row in real[:8]]) if real else torch.zeros(1, 3, SIZE, SIZE)
    parity = export_onnx(model, sample, args.out / 'icon-classifier.onnx', 'input', tolerance=1e-3)
    json.dump(assets.classes, open(args.out / 'icon-labels.json', 'w', encoding='utf-8'))
    json.dump({'history': history, 'classes': len(assets.classes), 'input': [SIZE, SIZE], 'crop': '1.3x the slot region',
               'mean': MEAN.tolist(), 'std': STD.tolist(), 'arch': args.arch, 'seed': args.seed, 'selection': 'last epoch',
               'initialization': str(args.init_pt or args.init_onnx or 'ImageNet'), 'onnx_max_abs_error': parity}, open(args.out / 'report.json', 'w', encoding='utf-8'), indent=1)


if __name__ == '__main__':
    main()
