#!/usr/bin/env python3
"""
캐릭터 스프라이트 시트에서 몸통 + 개별 표정 추출 (v3)
연결 컴포넌트 방식: 투명으로 분리된 모든 덩어리를 찾아 크기별로 분류

Usage: python3 scripts/cut-sprites.py [--char DonQuixote]
"""

import sys
from PIL import Image
from pathlib import Path
from collections import deque

SRC_DIR = Path.home() / "Downloads" / "characters"
OUT_DIR = Path.home() / "Downloads" / "characters_cut"

# 표정 없는 파일
NO_FACES = {'Wolf.png', 'Panther.png', 'Lion.png',
            'Dante.png', 'Dante2.png', 'Dante3.png', 'Dante 565864.png'}

ALPHA_THRESHOLD = 20
# 축소 배율 (속도: 원본 대비)
SCALE = 4


def find_blobs(img):
    """축소 이미지에서 비투명 연결 컴포넌트(blob) 찾기"""
    w, h = img.size
    sw, sh = w // SCALE, h // SCALE
    small = img.resize((sw, sh), Image.NEAREST)
    alpha = small.split()[3] if small.mode == 'RGBA' else None
    if not alpha:
        return []

    visited = [[False] * sw for _ in range(sh)]
    blobs = []

    for sy in range(sh):
        for sx in range(sw):
            if visited[sy][sx] or alpha.getpixel((sx, sy)) < ALPHA_THRESHOLD:
                visited[sy][sx] = True
                continue

            # BFS flood fill
            queue = deque([(sx, sy)])
            visited[sy][sx] = True
            pixels = []
            min_x = max_x = sx
            min_y = max_y = sy

            while queue:
                cx, cy = queue.popleft()
                pixels.append((cx, cy))
                min_x = min(min_x, cx)
                max_x = max(max_x, cx)
                min_y = min(min_y, cy)
                max_y = max(max_y, cy)

                for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                    nx, ny = cx + dx, cy + dy
                    if 0 <= nx < sw and 0 <= ny < sh and not visited[ny][nx]:
                        visited[ny][nx] = True
                        if alpha.getpixel((nx, ny)) >= ALPHA_THRESHOLD:
                            queue.append((nx, ny))

            # 원본 좌표로 변환
            blob = {
                'x1': min_x * SCALE,
                'y1': min_y * SCALE,
                'x2': (max_x + 1) * SCALE,
                'y2': (max_y + 1) * SCALE,
                'pixel_count': len(pixels),
                'w': (max_x - min_x + 1) * SCALE,
                'h': (max_y - min_y + 1) * SCALE,
            }
            if blob['w'] > 8 and blob['h'] > 8:  # 노이즈 제거
                blobs.append(blob)

    return blobs


def classify_blobs(blobs):
    """blob을 body(가장 큰)와 faces(나머지 비슷한 크기)로 분류"""
    if not blobs:
        return None, []

    # 픽셀 수 기준 정렬
    sorted_blobs = sorted(blobs, key=lambda b: b['pixel_count'], reverse=True)
    body = sorted_blobs[0]

    # 나머지 중 face 크기 필터 (body의 1/4 이하, 최소 크기 이상)
    faces = []
    for b in sorted_blobs[1:]:
        if b['pixel_count'] < body['pixel_count'] * 0.4 and b['w'] > 30 and b['h'] > 30:
            faces.append(b)

    # face를 위치 순 정렬 (위→아래, 왼→오른)
    faces.sort(key=lambda b: (b['y1'], b['x1']))

    return body, faces


def crop_with_padding(img, x1, y1, x2, y2, pad=4):
    """패딩 포함 crop"""
    w, h = img.size
    return img.crop((
        max(0, x1 - pad),
        max(0, y1 - pad),
        min(w, x2 + pad),
        min(h, y2 + pad),
    ))


def process_sprite(filepath):
    name = filepath.stem
    print(f"\n{'='*40}")
    print(f"  {name}")
    print(f"{'='*40}")

    img = Image.open(filepath)
    if img.mode != 'RGBA':
        print(f"  SKIP: not RGBA")
        return

    out_dir = OUT_DIR / name
    out_dir.mkdir(parents=True, exist_ok=True)

    blobs = find_blobs(img)
    print(f"  Blobs found: {len(blobs)}")

    body, faces = classify_blobs(blobs)

    if body is None:
        print(f"  No content found")
        return

    # Body 저장
    body_img = crop_with_padding(img, body['x1'], body['y1'], body['x2'], body['y2'])
    body_img.save(out_dir / f"{name}_body.webp", "WEBP", quality=90)
    print(f"  Body: {body['w']}x{body['h']} at ({body['x1']},{body['y1']})")

    # Faces 저장
    for i, face in enumerate(faces):
        face_img = crop_with_padding(img, face['x1'], face['y1'], face['x2'], face['y2'], pad=2)
        face_img.save(out_dir / f"{name}_face_{i:02d}.webp", "WEBP", quality=90)

    print(f"  Faces: {len(faces)}")


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    target = None
    if '--char' in sys.argv:
        idx = sys.argv.index('--char')
        if idx + 1 < len(sys.argv):
            target = sys.argv[idx + 1]

    files = sorted(SRC_DIR.glob("*.png"))
    for f in files:
        if f.name in NO_FACES:
            out_dir = OUT_DIR / f.stem
            out_dir.mkdir(parents=True, exist_ok=True)
            img = Image.open(f)
            img.save(out_dir / f"{f.stem}_body.webp", "WEBP", quality=90)
            print(f"  {f.stem}: body only (NPC)")
            continue

        if target and target not in f.stem:
            continue

        process_sprite(f)


if __name__ == '__main__':
    main()
