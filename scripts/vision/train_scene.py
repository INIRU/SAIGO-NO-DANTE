#!/usr/bin/env python3
"""Train an auditable scene-state classifier from explicitly reviewed frames.

Annotation JSONL schema (one exact frame per line):
{"reviewed":true,"scene_id":"run-001","video":"run.mp4",
 "frame_index":1234,"timestamp_seconds":20.5667,"label":"shop"}

Manifest JSON schema:
{"videos":{"run.mp4":{"path":"run.mp4","fps":60,
 "frame_count":515679}}}
Paths are resolved relative to --video-root. Optional sha256 is descriptive;
the 21 GB source is not re-hashed on each training run.
"""
import argparse
import json
import math
import random
from collections import Counter
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort
import torch
from PIL import Image
from torch import nn
from torch.utils.data import DataLoader, Dataset
from torchvision import models, transforms


def read_annotations(path, manifest):
    videos = manifest.get("videos")
    if not isinstance(videos, dict) or not videos:
        raise ValueError("manifest must contain a non-empty 'videos' object")
    rows, seen = [], set()
    for line_no, line in enumerate(Path(path).read_text().splitlines(), 1):
        if not line.strip():
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError as exc:
            raise ValueError(f"annotation line {line_no}: invalid JSON") from exc
        required = ("reviewed", "scene_id", "video", "frame_index", "timestamp_seconds", "label")
        if any(key not in row for key in required) or row["reviewed"] is not True:
            raise ValueError(f"annotation line {line_no}: all fields and reviewed:true are required")
        if not all(isinstance(row[k], str) and row[k].strip() for k in ("scene_id", "video", "label")):
            raise ValueError(f"annotation line {line_no}: scene_id, video, and label must be non-empty strings")
        if row["video"] not in videos:
            raise ValueError(f"annotation line {line_no}: unknown video {row['video']!r}")
        meta = videos[row["video"]]
        if not isinstance(meta, dict) or not isinstance(meta.get("path"), str) or not meta["path"].strip():
            raise ValueError(f"annotation line {line_no}: invalid video path metadata")
        frame = row["frame_index"]
        timestamp = row["timestamp_seconds"]
        fps, count = meta.get("fps"), meta.get("frame_count")
        if (isinstance(frame, bool) or not isinstance(frame, int) or isinstance(count, bool)
                or not isinstance(count, int) or isinstance(fps, bool) or not isinstance(fps, (int, float))
                or not math.isfinite(fps) or fps <= 0):
            raise ValueError(f"annotation line {line_no}: invalid frame index or video metadata")
        if (frame < 0 or frame >= count or not isinstance(timestamp, (int, float))
                or isinstance(timestamp, bool) or not math.isfinite(timestamp)):
            raise ValueError(f"annotation line {line_no}: frame/timestamp is out of range")
        if abs(timestamp - frame / fps) > 0.5 / fps + 1e-6:
            raise ValueError(f"annotation line {line_no}: timestamp does not match frame_index/fps")
        key = (row["video"], frame)
        if key in seen:
            raise ValueError(f"annotation line {line_no}: duplicate video/frame annotation")
        seen.add(key)
        rows.append(row)
    if not rows:
        raise ValueError("no reviewed annotations found")
    if len({r["scene_id"] for r in rows}) < 3:
        raise ValueError("at least 3 distinct scene_id groups are required for train/validation/test")
    return rows


def split_scenes(rows):
    """Split whole scene groups into train/validation/test; no temporal block crosses a boundary.

    With seven or more groups per video, every seventh group of each video (in time order) goes to validation and the
    next to test, so every recording (and UI theme) is represented in all three. Otherwise a chronological 70/15/15 split.
    """
    groups = sorted({r["scene_id"] for r in rows}, key=lambda g: min(
        (r["video"], r["timestamp_seconds"]) for r in rows if r["scene_id"] == g))
    n = len(groups)
    if n >= 7:
        video_of = {r["scene_id"]: r["video"] for r in rows}
        position, assignment = Counter(), {}
        for g in groups:
            i = position[video_of[g]]; position[video_of[g]] += 1
            assignment[g] = "validation" if i % 7 == 5 else "test" if i % 7 == 6 else "train"
        return {name: [r for r in rows if assignment[r["scene_id"]] == name]
                for name in ("train", "validation", "test")}
    n_train, n_val = max(1, int(n * .70)), max(1, int(n * .15))
    if n_train + n_val >= n:
        n_train, n_val = n - 2, 1
    assignment = {g: ("train" if i < n_train else "validation" if i < n_train + n_val else "test") for i, g in enumerate(groups)}
    return {name: [r for r in rows if assignment[r["scene_id"]] == name]
            for name in ("train", "validation", "test")}


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


class FrameDataset(Dataset):
    def __init__(self, rows, manifest, root, labels, preprocessing, augment=None):
        self.items = []
        self.transform = preprocessing
        self.augment = augment
        for row in rows:
            meta = manifest["videos"][row["video"]]
            video = (Path(root) / meta["path"]).resolve()
            if not video.is_file():
                raise ValueError(f"video does not exist: {video}")
            cap = cv2.VideoCapture(str(video))
            if not cap.isOpened():
                raise ValueError(f"cannot open video: {video}")
            actual_fps = cap.get(cv2.CAP_PROP_FPS)
            actual_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            if abs(actual_fps - meta["fps"]) > .05 or actual_frames != meta["frame_count"]:
                cap.release()
                raise ValueError(f"video metadata differs from manifest: {video.name}")
            cap.set(cv2.CAP_PROP_POS_FRAMES, row["frame_index"])
            ok, frame = cap.read()
            cap.release()
            if not ok:
                raise ValueError(f"cannot decode frame {row['frame_index']} from {video.name}")
            # Kept at 480x270 (the model input is 224x224, full frame): augmentation runs per epoch on this copy.
            image = Image.fromarray(cv2.cvtColor(cv2.resize(frame, (480, 270), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2RGB))
            self.items.append((image, labels[row["label"]]))

    def __len__(self):
        return len(self.items)

    def __getitem__(self, index):
        image, label = self.items[index]
        return self.transform(self.augment(image) if self.augment else image), label


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
    return {"samples": len(actual), "accuracy": sum(a == p for a, p in zip(actual, predicted)) / len(actual),
            "per_class": result}


def self_check():
    import tempfile
    manifest = {"videos": {"x.mp4": {"path": "x.mp4", "fps": 60, "frame_count": 100}}}
    rows = [{"reviewed": True, "scene_id": f"s{i}", "video": "x.mp4", "frame_index": i,
             "timestamp_seconds": i / 60, "label": "shop"} for i in range(3)]
    with tempfile.TemporaryDirectory() as tmp:
        ann = Path(tmp) / "ok.jsonl"
        ann.write_text("\n".join(json.dumps(r) for r in rows))
        parsed = read_annotations(ann, manifest)
        split = split_scenes(parsed)
        assert [len(split[k]) for k in ("train", "validation", "test")] == [1, 1, 1]
        assert all(len({r["scene_id"] for r in split[a]} & {r["scene_id"] for r in split[b]}) == 0
                   for a, b in (("train", "validation"), ("train", "test"), ("validation", "test")))
        ann.write_text(json.dumps({**rows[0], "reviewed": False}))
        try:
            read_annotations(ann, manifest)
        except ValueError:
            pass
        else:
            raise AssertionError("unreviewed annotations must be rejected")
        ann.write_text(json.dumps({**rows[0], "timestamp_seconds": 5}))
        try:
            read_annotations(ann, manifest)
        except ValueError:
            pass
        else:
            raise AssertionError("timestamp/frame mismatch must be rejected")
        for bad_manifest in (
            {"videos": {"x.mp4": {"path": "x.mp4", "fps": float("inf"), "frame_count": 100}}},
            {"videos": {"x.mp4": {"path": "x.mp4", "fps": True, "frame_count": 100}}},
            {"videos": {"x.mp4": {"path": "x.mp4", "fps": 60, "frame_count": True}}},
        ):
            ann.write_text(json.dumps(rows[0]))
            try:
                read_annotations(ann, bad_manifest)
            except ValueError:
                pass
            else:
                raise AssertionError("non-finite or boolean video metadata must be rejected")
        ann.write_text(json.dumps({**rows[0], "timestamp_seconds": float("nan")}))
        try:
            read_annotations(ann, manifest)
        except ValueError:
            pass
        else:
            raise AssertionError("non-finite timestamps must be rejected")
    tiny = nn.Sequential(nn.Flatten(), nn.Linear(3 * 2 * 2, 2)).eval()
    metric = evaluate(tiny, [(torch.zeros(1, 3, 2, 2), torch.tensor([0]))], "cpu", ["shop", "battle"])
    assert metric["per_class"]["battle"]["unsupported"] is True
    with tempfile.TemporaryDirectory() as tmp:
        onnx_path = Path(tmp) / "parity.onnx"
        sample = torch.randn(1, 3, 2, 2)
        torch.onnx.export(tiny, sample, onnx_path, input_names=["image"], output_names=["logits"], opset_version=17, dynamo=False)
        actual = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"]).run(None, {"image": sample.numpy()})[0]
        assert np.allclose(tiny(sample).detach().numpy(), actual, atol=1e-4, rtol=1e-4)
    print("annotation validation, scene split, unsupported-class, and ONNX parity self-check passed")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path)
    parser.add_argument("--annotations", type=Path)
    parser.add_argument("--video-root", type=Path)
    parser.add_argument("--out", type=Path)
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--self-check", action="store_true")
    args = parser.parse_args()
    if args.self_check:
        self_check()
        return
    if not all((args.manifest, args.annotations, args.video_root, args.out)):
        parser.error("--manifest, --annotations, --video-root, and --out are required")
    if args.epochs < 1 or args.batch_size < 1:
        parser.error("--epochs and --batch-size must be positive")
    manifest = json.loads(args.manifest.read_text())
    rows = read_annotations(args.annotations, manifest)
    splits = split_scenes(rows)
    labels = sorted({r["label"] for r in rows})
    label_ids = {label: i for i, label in enumerate(labels)}
    random.seed(42)
    np.random.seed(42)
    torch.manual_seed(42)
    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    weights = models.MobileNet_V3_Small_Weights.DEFAULT
    weight_preprocessing = weights.transforms()
    preprocessing = transforms.Compose([
        transforms.Resize((224, 224), interpolation=weight_preprocessing.interpolation, antialias=True),
        transforms.ToTensor(),
        transforms.Normalize(weight_preprocessing.mean, weight_preprocessing.std),
    ])
    # Captures differ in UI theme, brightness and window crop; the black theme is simulated on a third of the frames.
    augment = transforms.Compose([
        transforms.RandomApply([transforms.Lambda(black_theme)], p=.3),
        transforms.ColorJitter(brightness=.25, contrast=.2, saturation=.2),
        transforms.RandomResizedCrop((270, 480), scale=(.85, 1), ratio=(1.7, 1.85)),
    ])
    data = {name: FrameDataset(part, manifest, args.video_root, label_ids, preprocessing,
                               augment if name == "train" else None)
            for name, part in splits.items()}
    # Battle frames dominate recordings: sample every class about equally per epoch.
    counts = Counter(label for _, label in data["train"].items)
    sample_weights = [1 / counts[label] for _, label in data["train"].items]
    sampler = torch.utils.data.WeightedRandomSampler(sample_weights, num_samples=len(sample_weights), replacement=True)
    loaders = {name: DataLoader(ds, batch_size=args.batch_size, sampler=sampler if name == "train" else None)
               for name, ds in data.items()}
    model = models.mobilenet_v3_small(weights=weights)
    model.classifier[-1] = nn.Linear(model.classifier[-1].in_features, len(labels))
    for parameter in model.parameters():
        parameter.requires_grad = False
    # The last feature blocks and the classifier head learn; earlier ImageNet features stay fixed.
    trainable = [*model.features[9:].parameters(), *model.classifier.parameters()]
    for parameter in trainable:
        parameter.requires_grad = True
    model.to(device)
    optimizer = torch.optim.AdamW([{"params": model.features[9:].parameters(), "lr": 3e-4},
                                   {"params": model.classifier.parameters(), "lr": 1e-3}], weight_decay=1e-4)
    loss_fn = nn.CrossEntropyLoss(label_smoothing=.05)
    for epoch in range(args.epochs):
        model.train()
        for images, target in loaders["train"]:
            optimizer.zero_grad(set_to_none=True)
            loss_fn(model(images.to(device)), target.to(device)).backward()
            optimizer.step()
    report = {name: evaluate(model, loaders[name], device, labels)
              for name in ("train", "validation", "test")}
    args.out.mkdir(parents=True, exist_ok=True)
    model = model.cpu().eval()
    sample = data["test"][0][0].unsqueeze(0)
    onnx_path = args.out / "scene-mobilenetv3-small.onnx"
    torch.onnx.export(model, sample, onnx_path, input_names=["image"], output_names=["logits"],
                      dynamic_axes={"image": {0: "batch"}, "logits": {0: "batch"}}, opset_version=17,
                      dynamo=False)
    with torch.inference_mode():
        expected = model(sample).numpy()
    actual = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"]).run(None, {"image": sample.numpy()})[0]
    parity = float(np.max(np.abs(expected - actual)))
    if not np.allclose(expected, actual, atol=1e-4, rtol=1e-4):
        raise RuntimeError(f"ONNX numerical parity failed (max abs error {parity})")
    torch.save(model.state_dict(), args.out / "scene-mobilenetv3-small.pth")
    preprocess_report = {
        "color_order": "RGB",
        "input_layout": "NCHW",
        "input_size": [224, 224],
        "resize": "full frame directly to 224x224; aspect ratio is stretched",
        "interpolation": "bilinear with antialias",
        "scale": 0.00392156862745098,
        "mean": weights.transforms().mean,
        "std": weights.transforms().std,
        "normalization": "(RGB / 255 - mean) / std",
    }
    (args.out / "report.json").write_text(json.dumps({
        "task": "experimental scene-state classification only; not gift identity or transaction recognition",
        "labels": labels,
        "split_groups": {name: sorted({r["scene_id"] for r in part}) for name, part in splits.items()},
        "split_samples": {name: len(part) for name, part in splits.items()},
        "evaluation": report,
        "onnx_max_abs_error": parity,
        "onnx_parity_input": "first actual held-out test frame",
        "preprocessing": preprocess_report,
        "training": {"initialization": "MobileNet_V3_Small_Weights.DEFAULT", "trainable": "features[9:] and classifier",
                     "augmentation": "black UI theme simulation (p=.3), color jitter, 85-100% crops", "sampling": "class-balanced",
                     "epochs": args.epochs, "seed": 42},
        "limitations": [f"{len(rows)} reviewed frames from {len({r['video'] for r in rows})} recordings",
                        "screen class is not proof of a committed transaction",
                        "battle includes victory screens", "shop includes purchase confirmations and skill changes"],
    }, indent=2))
    (args.out / "labels.json").write_text(json.dumps(labels, indent=2))
    print(f"Exported {onnx_path}; ONNX max abs error {parity:.2g}")


if __name__ == "__main__":
    main()
