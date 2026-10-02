#!/usr/bin/env python3
"""Build the scene classifier's annotation file from recordings and from the Assist sample archive.

  python3 scripts/vision/build_scene_dataset.py --videos <work dir> --samples <samples dir> --caches <ocr cache.json>... --out <dir>

<work dir>: frames/<video>/<index>.jpg, teacher.jsonl (each frame's label by the model being replaced) and ocr.json
(scripts/vision/ocr_frames.ts) of the recordings. <samples dir>: scripts/vision/pull_samples.ts. The caches are OCR
results of sample frames: the caches of the sample replays (replay_sale_samples.ts, replay_fusion_samples.ts, keyed
"/frames/<path>/<n>.jpg") or ocr_frames.ts output (keyed "<path>/<n>.jpg").

A frame's label is what its screen says when the text decides it (the window title of the sell, enhance and fusion
windows, the shop's three buttons, the acquisition header, the pack selection header; a gift information or purchase
dialog takes the shop or pack selection under it). Recording frames whose text
decides nothing keep the earlier model's label when it was at least 0.8 sure; sample frames are used only with a text
label, so no label of a window shape the earlier model was not trained on comes from that model.
Frames are grouped (a sample group, or 30 s of a recording) and whole groups go to train, validation or test.
Writes <out>/annotations.jsonl: {root, file, label, source: "text"|"model", shape, scene_id, split}.
"""
import argparse, json, re
from collections import Counter, defaultdict
from pathlib import Path

from PIL import Image

CAP = 700  # frames per label and source: classes are sampled equally, so more of one screen adds little


def text_label(text):
    t = re.sub(r'\s+', '', text)
    if '획득했습니다' in t:
        return 'gift_acquired'
    # A gift's information or purchase dialog looks like the acquisition popup; it belongs to the screen under it.
    if '기프트구매' in t:
        return 'shop'  # only the shop sells
    if '기프트정보' in t:
        return 'shop' if '상점' in t else 'theme_select' if '테마팩선택' in t else None
    if '하시겠습니까' in t:
        return None  # other confirmation dialogs keep the earlier model's label
    buttons = [word in t for word in ('기프트강화', '기프트합성', '기프트판매')]
    if all(buttons):
        return 'shop'
    for word, label in (('판매', 'sell'), ('강화', 'enhance'), ('합성', 'fusion')):
        if re.search(r'E\.?G\.?O기프트' + word, t) and sum(buttons) == 1:
            return label
    if '테마팩선택' in t:
        return 'theme_select'
    return None


def shape(width, height):
    ratio = width / height
    return 'square' if ratio < 1.2 else 'tall' if ratio < 1.7 else '16:9' if ratio < 1.82 else 'wide'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--videos', type=Path, required=True)
    parser.add_argument('--samples', type=Path, required=True)
    parser.add_argument('--caches', type=Path, nargs='+', required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    rows = []
    ocr = json.load(open(args.videos / 'ocr.json'))
    for line in open(args.videos / 'teacher.jsonl'):
        frame = json.loads(line)
        label = text_label(ocr[frame['file']]['text']) if frame['file'] in ocr else None
        if label or frame['confidence'] >= 0.8:
            rows.append({'root': 'videos', 'file': frame['file'], 'label': label or frame['teacher'], 'source': 'text' if label else 'model',
                         'shape': '16:9', 'scene_id': f"{frame['video']}@{int(frame['timestamp_seconds'] // 30):04d}", 'model': frame['teacher']})
    for cache in args.caches:
        for url, screen in json.load(open(cache)).items():
            label = text_label(screen['text'])
            file = url[len('/frames/'):] if url.startswith('/frames/') else url
            if label and (args.samples / file).exists():
                with Image.open(args.samples / file) as image:
                    rows.append({'root': 'samples', 'file': file, 'label': label, 'source': 'text', 'shape': shape(*image.size), 'scene_id': file.rsplit('/', 1)[0]})
    rows = list({(row['root'], row['file']): row for row in rows}.values())
    # Whole groups per split, in a fixed order: every seventh group validates, the next tests.
    groups = sorted({row['scene_id'] for row in rows})
    split = {group: 'validation' if index % 7 == 5 else 'test' if index % 7 == 6 else 'train' for index, group in enumerate(groups)}
    kept, seen = [], Counter()
    for row in sorted(rows, key=lambda row: (row['scene_id'], row['file'])):
        row['split'] = split[row['scene_id']]
        key = (row['label'], row['root'], row['shape'] == '16:9')
        seen[key] += 1
        # Evaluation frames are all kept; training keeps every other shape and up to CAP of the common ones, spread evenly.
        if row['split'] != 'train' or row['shape'] != '16:9' or seen[key] <= CAP * 8:
            kept.append(row)
    by = defaultdict(list)
    for row in kept:
        by[(row['label'], row['root'], row['shape'] == '16:9', row['split'] == 'train')].append(row)
    out = []
    for (label, root, common, train), group in by.items():
        out += group if not (train and common) or len(group) <= CAP else group[::max(1, len(group) // CAP)][:CAP]
    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / 'annotations.jsonl').write_text('\n'.join(json.dumps(row, ensure_ascii=False) for row in out) + '\n')
    table = Counter((row['label'], row['split'], row['source']) for row in out)
    for label in sorted({row['label'] for row in out}):
        print(f"{label:14}", ' '.join(f"{part}:{table[(label, part, 'text')]}+{table[(label, part, 'model')]}" for part in ('train', 'validation', 'test')))
    print('frames', len(out), '| text + model labels per split | other shapes:', dict(Counter(row['shape'] for row in out if row['shape'] != '16:9')),
          '| text label differs from the earlier model on recordings:', sum(row['source'] == 'text' and row.get('model') != row['label'] for row in out if row['root'] == 'videos'))


if __name__ == '__main__':
    main()
