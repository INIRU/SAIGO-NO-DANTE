#!/usr/bin/env python3
"""Compare scene models on the frames of a scene dataset that no model trained on (validation and test splits).

  python3 scripts/vision/compare_scene_models.py --images <annotations.jsonl> --roots videos=<dir> samples=<dir> \
      --labels public/models/assist-scene/labels.json --models shipped=<scene.onnx> new=<scene.onnx>

Frames labelled by their text are the measure: correct, and correct with at least 0.5 (what the app acts on), by window
shape and screen. Frames labelled by the earlier model show what a new model changes on the other screens. A new model
replaces the shipped one only when the first improves and the second does not change (docs/assist.md).
"""
import argparse, json
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image

from assist_common import IMAGENET_MEAN as MEAN, IMAGENET_STD as STD


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--images', type=Path, required=True)
    parser.add_argument('--roots', nargs='+', required=True)
    parser.add_argument('--labels', type=Path, required=True)
    parser.add_argument('--models', nargs='+', required=True, help='name=path, the shipped model first')
    args = parser.parse_args()
    roots = {name: Path(folder) for name, folder in (item.split('=', 1) for item in args.roots)}
    labels = json.loads(args.labels.read_text(encoding='utf-8'))
    rows = [row for row in map(json.loads, args.images.read_text(encoding='utf-8').splitlines()) if row['split'] != 'train']
    # As the worker: the whole frame to 224x224, smoothed.
    frames = np.stack([((np.asarray(Image.open(roots[row['root']] / row['file']).convert('RGB').resize((224, 224), Image.BILINEAR), np.float32) / 255 - MEAN) / STD)
                       .transpose(2, 0, 1) for row in rows])
    truth = np.array([labels.index(row['label']) for row in rows])
    models = [item.split('=', 1) for item in args.models]
    read = {}
    for name, path in models:
        session = ort.InferenceSession(path, providers=['CPUExecutionProvider'])
        logits = np.concatenate([session.run(None, {session.get_inputs()[0].name: frames[i:i + 128]})[0] for i in range(0, len(rows), 128)])
        scores = np.exp(logits - logits.max(1, keepdims=True))
        scores /= scores.sum(1, keepdims=True)
        read[name] = (scores.argmax(1), scores.max(1))
    groups = defaultdict(list)
    for index, row in enumerate(rows):
        # labelled from the screen's own text or UI, not by an earlier model: these are scored against the truth
        by_text = row['source'] in ('text', 'ui-labelled sample')
        groups[('text' if by_text else 'earlier model', row['shape'] if by_text else '-', row['label'] if by_text else 'all')].append(index)
        if by_text:
            groups[('text', 'ALL', 'all')].append(index)
    print(f"{'label by':15}{'shape':8}{'screen':15}{'n':>5}  " + '  '.join(f'{name:>15}' for name, _ in models) + '   correct / correct and >= 0.5')
    for key in sorted(groups):
        picked = np.array(groups[key])
        cells = []
        for name, _ in models:
            top, score = read[name]
            right = top[picked] == truth[picked]
            cells.append(f'{right.mean():.3f} / {(right & (score[picked] >= 0.5)).mean():.3f}')
        print(f'{key[0]:15}{key[1]:8}{key[2]:15}{len(picked):>5}  ' + '  '.join(f'{cell:>15}' for cell in cells))
    for name, _ in models[1:]:
        top = read[name][0]
        changed = Counter((rows[i]['label'], labels[top[i]]) for i in groups[('earlier model', '-', 'all')] if top[i] != truth[i])
        print(f"{name}: differs from the earlier model's label on {sum(changed.values())} of {len(groups[('earlier model', '-', 'all')])}", dict(changed))


if __name__ == '__main__':
    main()
