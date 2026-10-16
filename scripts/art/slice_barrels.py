"""Slice a generated row of 4 mortar barrels into 160x160 barrel textures.

Usage: python3 scripts/art/slice_barrels.py <sheet.png> <orig_dir> <out_dir> key1 key2 key3 key4

- Keys out the background (plus any magenta smudges the generator left),
  splits the row at the emptiest columns, keeps each barrel's largest blob.
- One scale for the set (median of original/new heights), so relative sizes
  stay as drawn; the mount's bottom lines up with the original texture's
  bottom and the mount is centred on the rotation pivot (x = 80).
"""
import sys
import numpy as np
from PIL import Image
from key import key_array
from slice_towers import bbox

SIZE = 160  # 80*TEX
PIVOT_X = 80


def main(sheet, orig_dir, out_dir, keys):
    rgb = np.asarray(Image.open(sheet).convert('RGB')).astype(np.float32)
    rgba = key_array(rgb)
    r, g, b = (rgba[..., i].astype(np.int32) for i in range(3))
    rgba[(r - g > 40) & (b - g > 25), 3] = 0  # 背景上的洋紅色暈影
    rgba[:24, :, 3] = 0
    rgba[rgba[..., 3] < 40, 3] = 0
    alpha = rgba[..., 3].astype(np.int32)
    w = rgba.shape[1]
    col = (alpha > 20).sum(axis=0)
    n = len(keys)
    cuts = [0]
    for i in range(1, n):
        c = int(w * i / n)
        lo, hi = c - w // 12, c + w // 12
        cuts.append(lo + int(np.argmin(col[lo:hi])))
    cuts.append(w)
    pieces, origs = [], []
    for i, k in enumerate(keys):
        seg = rgba[:, cuts[i]:cuts[i + 1]].copy()
        x0, y0, x1, y1 = bbox(seg[..., 3], min_px=6)
        pieces.append(seg[y0:y1, x0:x1].copy())
        o = np.asarray(Image.open(f'{orig_dir}/{k}.png').convert('RGBA'))[..., 3]
        origs.append(bbox(o))
    scale = float(np.median([(o[3] - o[1]) / p.shape[0] for o, p in zip(origs, pieces)]))
    for k, p, o in zip(keys, pieces, origs):
        h, wd = p.shape[:2]
        s = min(scale, (SIZE - 4) / wd, (o[3] - 1) / h)
        img = Image.fromarray(p, 'RGBA').resize((max(1, round(wd * s)), max(1, round(h * s))), Image.LANCZOS)
        a = np.asarray(img)[..., 3]
        # 砲座（最下面 15%）的水平中心對準旋轉軸
        foot = a[int(a.shape[0] * 0.85):]
        xs = np.where((foot > 60).any(axis=0))[0]
        mount_cx = (xs.min() + xs.max()) / 2
        frame = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
        x = int(round(PIVOT_X - mount_cx))
        x = max(0, min(SIZE - img.width, x))
        frame.alpha_composite(img, (x, o[3] - img.height))
        frame.save(f'{out_dir}/{k}.webp', 'WEBP', quality=90, method=6)
        print(k, 'scale', round(s, 3), 'size', img.size, 'x', x)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4:])
