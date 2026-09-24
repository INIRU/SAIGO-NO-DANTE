#!/usr/bin/env python3
"""Export one local image encoder and normalized gift/event art vectors.

Input JSON has ``gifts`` and ``events`` arrays with numeric ``game_id``/``id``
and public ``image_url`` values. Optional --gift-dir/--event-dir contain
``<id>.webp`` files, avoiding repeat downloads during local regeneration.
"""

import argparse
import base64
import io
import json
import re
import urllib.request
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from torch import nn
from torchvision import transforms
from torchvision.models import MobileNet_V3_Small_Weights, mobilenet_v3_small


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True)
    parser.add_argument('--output-index', required=True)
    parser.add_argument('--output-model', required=True)
    parser.add_argument('--gift-dir')
    parser.add_argument('--event-dir')
    return parser.parse_args()


def image_for(entry, directory, key):
    if directory:
        return Image.open(Path(directory) / f'{key}.webp')
    with urllib.request.urlopen(entry['image_url'], timeout=20) as response:
        return Image.open(io.BytesIO(response.read()))


def prepare_gift(image):
    artwork = image.convert('RGBA')
    background = Image.new('RGBA', artwork.size, (30, 28, 27, 255))
    background.alpha_composite(artwork)
    return background.convert('RGB')


def prepare_event(image):
    artwork = image.convert('RGB')
    return artwork.crop((0, 0, artwork.width, max(1, round(artwork.height * 0.56))))


def main():
    args = parse_args()
    source = json.loads(Path(args.input).read_text())
    if not isinstance(source.get('gifts'), list) or not isinstance(source.get('events'), list):
        raise ValueError('Expected gifts and events arrays')

    torch.set_num_threads(4)
    network = mobilenet_v3_small(weights=MobileNet_V3_Small_Weights.DEFAULT).eval()
    encoder = nn.Sequential(network.features, network.avgpool, nn.Flatten(1)).eval()
    transform = transforms.Compose([
        transforms.Resize((224, 224)), transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])

    def encode(items, directory, prepare, key_name):
        result = []
        seen = set()
        for start in range(0, len(items), 16):
            batch = []
            keys = []
            for entry in items[start:start + 16]:
                image_url = entry.get('image_url')
                if key_name == 'art':
                    art = re.search(r'/([0-9]+)\.webp(?:\?|$)', image_url or '', re.I)
                    key = art.group(1) if art else ''
                else:
                    key = str(entry.get(key_name) or '')
                if not key.isdigit() or not image_url or key in seen:
                    continue
                batch.append(transform(prepare(image_for(entry, directory, key))))
                keys.append(key)
                seen.add(key)
            if not batch:
                continue
            with torch.inference_mode():
                vectors = encoder(torch.stack(batch))
                vectors = nn.functional.normalize(vectors, dim=1).numpy().astype('<f4')
            result.extend({'id': key, 'vector': base64.b64encode(vector.tobytes()).decode('ascii')}
                          for key, vector in zip(keys, vectors))
        return result

    gifts = encode(source['gifts'], args.gift_dir, prepare_gift, 'game_id')
    events = encode(source['events'], args.event_dir, prepare_event, 'art')
    if not gifts or not events:
        raise ValueError('No usable artwork')

    torch.onnx.export(encoder, torch.zeros(1, 3, 224, 224), args.output_model,
                      input_names=['image'], output_names=['embedding'], opset_version=17,
                      dynamic_axes={'image': {0: 'batch'}, 'embedding': {0: 'batch'}}, dynamo=False)
    Path(args.output_index).write_text(json.dumps({
        'version': 1, 'dimensions': 576, 'preprocessing': 'RGB 224x224 full crop, ImageNet mean/std',
        'gifts': gifts, 'events': events,
    }, separators=(',', ':')))
    print(json.dumps({'gifts': len(gifts), 'events': len(events), 'dimensions': 576}))


if __name__ == '__main__':
    main()
