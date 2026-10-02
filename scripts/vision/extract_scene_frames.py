#!/usr/bin/env python3
"""Take one frame every few seconds from recordings, with the shipped scene model's label, for build_scene_dataset.py.

  python3 scripts/vision/extract_scene_frames.py --videos <a.mp4> <b.mp4>... --out <work dir> [--every 3]

Writes <work dir>/frames/<video>/<frame index>.jpg (1280x720), teacher.jsonl ({video, frame_index, timestamp_seconds, file,
teacher, confidence}) and ocr-list.json: the frames whose text is worth reading with ocr_frames.ts (shop, sell, enhance,
fusion and acquisition screens, anything the model was under 0.8 sure of, and their neighbours in time).
About 9 minutes for 3.5 hours of 1080p60 on an Apple M-series (ten-minute slices run in parallel).
"""
import argparse, json
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort
from PIL import Image

MEAN = np.array([0.485, 0.456, 0.406], np.float32)
STD = np.array([0.229, 0.224, 0.225], np.float32)
TEXT_SCREENS = {'sell', 'enhance', 'shop', 'fusion', 'gift_acquired'}


def read_slice(job):
    video, out, start, end, every, model, labels = job
    options = ort.SessionOptions()
    options.intra_op_num_threads = 1
    session = ort.InferenceSession(model, options, providers=['CPUExecutionProvider'])
    capture = cv2.VideoCapture(video)
    fps = capture.get(cv2.CAP_PROP_FPS)
    name = Path(video).stem.replace(' ', '_')
    (Path(out) / 'frames' / name).mkdir(parents=True, exist_ok=True)
    rows, at = [], start
    while at < end:
        index = round(at * fps)
        capture.set(cv2.CAP_PROP_POS_FRAMES, index)
        ok, frame = capture.read()
        if not ok:
            break
        file = f'frames/{name}/{index:07d}.jpg'
        cv2.imwrite(str(Path(out) / file), cv2.resize(frame, (1280, 720), interpolation=cv2.INTER_AREA), [cv2.IMWRITE_JPEG_QUALITY, 88])
        # Labelled from the saved file with a smoothed downscale, as the worker and compare_scene_models.py do.
        pixels = (np.asarray(Image.open(Path(out) / file).convert('RGB').resize((224, 224), Image.BILINEAR), np.float32) / 255 - MEAN) / STD
        logits = session.run(None, {session.get_inputs()[0].name: pixels.transpose(2, 0, 1)[None]})[0][0]
        scores = np.exp(logits - logits.max())
        scores /= scores.sum()
        rows.append({'video': name, 'frame_index': index, 'timestamp_seconds': index / fps, 'file': file,
                     'teacher': labels[int(scores.argmax())], 'confidence': round(float(scores.max()), 4)})
        at += every
    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--videos', nargs='+', required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--every', type=float, default=3)
    parser.add_argument('--model', default='public/models/assist-scene/scene.onnx')
    parser.add_argument('--labels', type=Path, default=Path('public/models/assist-scene/labels.json'))
    args = parser.parse_args()
    labels = json.loads(args.labels.read_text())
    jobs = []
    for video in args.videos:
        capture = cv2.VideoCapture(video)
        seconds = capture.get(cv2.CAP_PROP_FRAME_COUNT) / capture.get(cv2.CAP_PROP_FPS)
        # Slices start on the sampling grid, so the frames are the same however the recording is split.
        step = args.every * round(600 / args.every)
        jobs += [(video, str(args.out), start, min(start + step, seconds), args.every, args.model, labels) for start in np.arange(0, seconds, step)]
    args.out.mkdir(parents=True, exist_ok=True)
    with ProcessPoolExecutor() as pool:
        rows = sorted((row for part in pool.map(read_slice, jobs) for row in part), key=lambda row: (row['video'], row['frame_index']))
    (args.out / 'teacher.jsonl').write_text('\n'.join(json.dumps(row) for row in rows) + '\n')
    read = set()
    for index, row in enumerate(rows):
        if row['teacher'] in TEXT_SCREENS or row['confidence'] < 0.8:
            read.update(rows[near]['file'] for near in (index - 1, index, index + 1) if 0 <= near < len(rows) and rows[near]['video'] == row['video'])
    (args.out / 'ocr-list.json').write_text(json.dumps(sorted(read)))
    print('frames', len(rows), '| to read with ocr_frames.ts', len(read))


if __name__ == '__main__':
    main()
