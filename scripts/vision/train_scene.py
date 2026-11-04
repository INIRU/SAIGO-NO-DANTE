#!/usr/bin/env python3
"""Train the Assist's scene-state classifier on labelled image files.

  python scripts/vision/train_scene.py --images <annotations.jsonl> --roots name=folder ... --labels <labels.json> --out <dir>
      [--arch mnv4s | --arch mnv3s [--init-onnx <shipped scene.onnx>]] [--epochs 20] [--batch-size 16]
  python scripts/vision/train_scene.py --self-check

Each annotation line names {root, file, label, split, source, shape} (scripts/vision/build_scene_dataset.py and
the dataset pipeline's scene_dataset.py write them); --roots gives each root's folder and --labels fixes the
class order to the shipped labels.json.
--arch mnv4s (shipped since 2026-11-04b): timm MobileNetV4-Conv-Small from ImageNet, every layer trained.
--arch mnv3s: torchvision MobileNetV3-small, its last feature blocks and head trained while the earlier blocks and their
batch norms stay fixed, from ImageNet or from a shipped scene.onnx (--init-onnx, its batch norms already folded).
The input is what the worker gives (lib/vision/preprocess.ts): the whole frame to 224x224, RGB, ImageNet mean and std.
Frames are kept at 480x270 for augmentation (as the dataset scripts store them), then resized with antialias.
Writes <out>/scene-<arch>.onnx (checked against PyTorch), <out>/labels.json and <out>/report.json.
"""
import argparse
import json
import random
from collections import Counter
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from torch import nn
from torch.utils.data import DataLoader, Dataset
from torchvision import models, transforms

from assist_common import IMAGENET_MEAN, IMAGENET_STD, SCENE_SIZE, export_onnx, from_onnx, mnv4s

SPLITS = ("train", "validation", "test")


def black_theme(image):
    """Approximates the game's black UI theme: warm low-chroma chrome (brown panels, frames) turns dark grey."""
    a = np.asarray(image, dtype=np.float32) / 255
    high, low = a.max(2), a.min(2)
    chroma = high - low
    warm = (a[..., 2] <= a[..., 1]) & (a[..., 1] <= a[..., 0] + .02)
    chrome = warm * np.clip((.35 - chroma) / .1, 0, 1) * np.clip((chroma - .015) / .025, 0, 1)
    light = a @ np.array([.299, .587, .114], dtype=np.float32)
    grey = np.where(light > .6, light, light * .35)[..., None]
    out = a * (1 - chrome[..., None]) + grey * chrome[..., None]
    return Image.fromarray((out * 255).clip(0, 255).astype(np.uint8))


class ImageDataset(Dataset):
    def __init__(self, rows, roots, labels, preprocessing, augment=None):
        self.transform = preprocessing
        self.augment = augment
        self.items = []
        for row in rows:
            with Image.open(roots[row["root"]] / row["file"]) as image:
                # kept at 480x270 like the dataset frames; the whole capture, stretched as the worker stretches it
                self.items.append((image.convert("RGB").resize((480, 270), Image.BOX), labels[row["label"]]))

    def __len__(self):
        return len(self.items)

    def __getitem__(self, index):
        image, label = self.items[index]
        return self.transform(self.augment(image) if self.augment else image), label


def read_image_annotations(path, roots, labels):
    rows = [json.loads(line) for line in Path(path).read_text(encoding="utf-8").splitlines() if line.strip()]
    for number, row in enumerate(rows, 1):
        if row.get("root") not in roots or row.get("label") not in labels or row.get("split") not in SPLITS:
            raise ValueError(f"image annotation line {number}: unknown root, label or split")
        if not (roots[row["root"]] / row["file"]).is_file():
            raise ValueError(f"image annotation line {number}: missing file {row['file']}")
    return rows


def evaluate(model, loader, device, labels):
    model.eval()
    actual, predicted = [], []
    with torch.inference_mode():
        for images, target in loader:
            logits = model(images.to(device))
            actual.extend(target.tolist())
            predicted.extend(logits.argmax(1).cpu().tolist())
    support = Counter(actual)
    result = {}
    for index, label in enumerate(labels):
        tp = sum(a == index and p == index for a, p in zip(actual, predicted))
        fp = sum(a != index and p == index for a, p in zip(actual, predicted))
        fn = sum(a == index and p != index for a, p in zip(actual, predicted))
        result[label] = {"support": support[index], "accuracy": tp / support[index] if support[index] else None,
                         "precision": tp / (tp + fp) if tp + fp else 0.0,
                         "recall": tp / (tp + fn) if tp + fn else None,
                         "unsupported": support[index] == 0}
    return {"samples": len(actual), "accuracy": sum(a == p for a, p in zip(actual, predicted)) / len(actual) if actual else None,
            "per_class": result}


def self_check():
    import tempfile
    tiny = nn.Sequential(nn.Flatten(), nn.Linear(3 * 2 * 2, 2)).eval()
    metric = evaluate(tiny, [(torch.zeros(1, 3, 2, 2), torch.tensor([0]))], "cpu", ["shop", "battle"])
    assert metric["per_class"]["battle"]["unsupported"] is True
    assert evaluate(tiny, [], "cpu", ["shop", "battle"])["accuracy"] is None
    with tempfile.TemporaryDirectory() as tmp:
        assert export_onnx(tiny, torch.randn(1, 3, 2, 2), Path(tmp) / "parity.onnx", "image") < 1e-4
    print("unsupported-class, empty-split and ONNX parity self-check passed")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--images", type=Path, help="annotations.jsonl of image files")
    parser.add_argument("--roots", nargs="*", default=[], help="name=folder for each root the annotations name")
    parser.add_argument("--labels", type=Path, help="labels.json fixing the class order")
    parser.add_argument("--out", type=Path)
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--init-onnx", type=Path, help="mnv3s only: start from this exported scene model instead of ImageNet")
    parser.add_argument("--arch", choices=("mnv3s", "mnv4s"), default="mnv4s")
    parser.add_argument("--self-check", action="store_true")
    args = parser.parse_args()
    if args.self_check:
        self_check()
        return
    if not (args.images and args.out and args.labels and args.roots):
        parser.error("--images, --roots, --labels and --out are required")
    if args.epochs < 1 or args.batch_size < 1:
        parser.error("--epochs and --batch-size must be positive")
    if args.init_onnx and args.arch != "mnv3s":
        parser.error("--init-onnx rebuilds a MobileNetV3 model (--arch mnv3s)")
    roots = {name: Path(folder) for name, folder in (item.split("=", 1) for item in args.roots)}
    labels = json.loads(args.labels.read_text(encoding='utf-8'))
    rows = read_image_annotations(args.images, roots, labels)
    splits = {name: [r for r in rows if r["split"] == name] for name in SPLITS}
    for name in ("train", "test"):
        if not splits[name]:
            parser.error(f"the {name} split is empty")
    label_ids = {label: i for i, label in enumerate(labels)}
    random.seed(42)
    np.random.seed(42)
    torch.manual_seed(42)
    device = torch.device("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")
    preprocessing = transforms.Compose([
        transforms.Resize((SCENE_SIZE, SCENE_SIZE), interpolation=transforms.InterpolationMode.BILINEAR, antialias=True),
        transforms.ToTensor(),
        transforms.Normalize(IMAGENET_MEAN.tolist(), IMAGENET_STD.tolist()),
    ])
    # Captures differ in UI theme, brightness and window crop; the black theme is simulated on a third of the frames.
    augment = transforms.Compose([
        transforms.RandomApply([transforms.Lambda(black_theme)], p=.3),
        transforms.ColorJitter(brightness=.25, contrast=.2, saturation=.2),
        transforms.RandomResizedCrop((270, 480), scale=(.85, 1), ratio=(1.7, 1.85)),
    ])
    data = {name: ImageDataset(part, roots, label_ids, preprocessing, augment if name == "train" else None) for name, part in splits.items()}
    # Battle frames dominate recordings: classes are sampled about equally per epoch, a screen with a handful of frames
    # not repeated to a full share
    counts = Counter(label for _, label in data["train"].items)
    sample_weights = [1 / max(counts[label], 50) for _, label in data["train"].items]
    sampler = torch.utils.data.WeightedRandomSampler(sample_weights, num_samples=len(sample_weights), replacement=True)
    loaders = {name: DataLoader(ds, batch_size=args.batch_size, sampler=sampler if name == "train" else None) for name, ds in data.items()}
    frozen = None
    if args.arch == "mnv4s":
        model = mnv4s(len(labels))
        head = list(model.get_classifier().parameters())
        body = [p for p in model.parameters() if all(p is not h for h in head)]
        model.to(device)
        optimizer = torch.optim.AdamW([{"params": body, "lr": 5e-4}, {"params": head, "lr": 2e-3}], weight_decay=1e-4)
        training = {"initialization": "ImageNet (timm mobilenetv4_conv_small.e2400_r224_in1k)", "trainable": "every layer"}
    else:
        if args.init_onnx:
            model = from_onnx(args.init_onnx, len(labels))
        else:
            model = models.mobilenet_v3_small(weights=models.MobileNet_V3_Small_Weights.DEFAULT)
            model.classifier[-1] = nn.Linear(model.classifier[-1].in_features, len(labels))
        for parameter in model.parameters():
            parameter.requires_grad = False
        # The last feature blocks and the classifier head learn; earlier ImageNet features stay fixed, batch norms included
        for parameter in [*model.features[9:].parameters(), *model.classifier.parameters()]:
            parameter.requires_grad = True
        frozen = model.features[:9]
        model.to(device)
        # A model that already knows the screens is corrected with smaller steps than one starting from ImageNet.
        rate = .2 if args.init_onnx else 1
        optimizer = torch.optim.AdamW([{"params": model.features[9:].parameters(), "lr": 3e-4 * rate},
                                       {"params": model.classifier.parameters(), "lr": 1e-3 * rate}], weight_decay=1e-4)
        training = {"initialization": str(args.init_onnx) if args.init_onnx else "ImageNet (MobileNet_V3_Small_Weights.DEFAULT)",
                    "trainable": "features[9:] and classifier"}
    loss_fn = nn.CrossEntropyLoss(label_smoothing=.05)
    for epoch in range(args.epochs):
        model.train()
        if frozen is not None:
            frozen.eval()  # fixed layers keep their batch norm statistics
        for images, target in loaders["train"]:
            optimizer.zero_grad(set_to_none=True)
            loss_fn(model(images.to(device)), target.to(device)).backward()
            optimizer.step()
    report = {name: evaluate(model, loaders[name], device, labels) for name in SPLITS}
    args.out.mkdir(parents=True, exist_ok=True)
    onnx_path = args.out / f"scene-{args.arch}.onnx"
    parity = export_onnx(model, data["test"][0][0].unsqueeze(0), onnx_path, "image")
    (args.out / "report.json").write_text(json.dumps({
        "task": "scene-state classification only; not gift identity or transaction recognition",
        "labels": labels,
        "split_groups": {name: sorted({r.get("scene_id", r["file"]) for r in part}) for name, part in splits.items()},
        "split_samples": {name: len(part) for name, part in splits.items()},
        "evaluation": report,
        "onnx_max_abs_error": parity,
        "onnx_parity_input": "first held-out test frame",
        "preprocessing": {"color_order": "RGB", "input_layout": "NCHW", "input_size": [SCENE_SIZE, SCENE_SIZE],
                          "resize": "full frame directly to 224x224; aspect ratio is stretched", "interpolation": "bilinear with antialias",
                          "scale": 1 / 255, "mean": IMAGENET_MEAN.tolist(), "std": IMAGENET_STD.tolist(), "normalization": "(RGB / 255 - mean) / std"},
        "training": {**training, "arch": args.arch, "augmentation": "black UI theme simulation (p=.3), color jitter, 85-100% crops",
                     "sampling": "class-balanced", "epochs": args.epochs, "seed": 42},
        "limitations": [f"{len(rows)} frames, {sum(r.get('source') == 'model' for r in rows)} of them labelled by an earlier model",
                        "screen class is not proof of a committed transaction",
                        "battle includes victory screens", "shop includes purchase confirmations and skill changes"],
    }, indent=2))
    (args.out / "labels.json").write_text(json.dumps(labels, indent=2))
    print(f"Exported {onnx_path}; ONNX max abs error {parity:.2g}")


if __name__ == "__main__":
    main()
