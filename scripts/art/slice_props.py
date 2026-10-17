"""Slice a generated row of props (map hazards etc.) into separate WebP sprites.

Usage: python3 scripts/art/slice_props.py <sheet.png> <out_dir> <scale> key1 key2 ...

Keys out the background, splits the row at the emptiest columns between the
objects and trims each one. Every piece uses the same scale so relative sizes
stay as drawn.
"""
import sys
import numpy as np
from PIL import Image
from key import key_array
from slice_towers import bbox


def main_run(prof, gap=8):
    """Mask of the biggest run of non-empty entries (gaps shorter than `gap` are bridged)."""
    on = prof > 2
    runs, start, last = [], None, -gap - 1
    for i, v in enumerate(on):
        if not v:
            continue
        if start is None or i - last > gap:
            if start is not None:
                runs.append((start, last + 1))
            start = i
        last = i
    if start is not None:
        runs.append((start, last + 1))
    a, b = max(runs, key=lambda r: prof[r[0]:r[1]].sum())
    m = np.zeros(len(prof), bool)
    m[a:b] = True
    return m


def main(sheet, out_dir, scale, keys):
    rgb = np.asarray(Image.open(sheet).convert('RGB')).astype(np.float32)
    rgba = key_array(rgb)
    r, g, b = (rgba[..., i].astype(np.int32) for i in range(3))
    rgba[(r - g > 60) & (b - g > 45) & (rgba[..., 3] < 255), 3] = 0  # 邊緣殘留的洋紅色
    rgba[rgba[..., 3] < 40, 3] = 0
    w = rgba.shape[1]
    col = (rgba[..., 3] > 20).sum(axis=0)
    n = len(keys)
    cuts = [0]
    for i in range(1, n):
        c = int(w * i / n)
        lo, hi = c - w // 10, c + w // 10
        cuts.append(lo + int(np.argmin(col[lo:hi])))
    cuts.append(w)
    for i, k in enumerate(keys):
        seg = rgba[:, cuts[i]:cuts[i + 1]].copy()
        # 只留最大的一段連續內容（去掉離得很遠的雜點）
        for axis in (1, 0):
            prof = (seg[..., 3] > 20).sum(axis=axis)
            keep = main_run(prof)
            if axis == 1:
                seg[~keep, :, 3] = 0
            else:
                seg[:, ~keep, 3] = 0
        x0, y0, x1, y1 = bbox(seg[..., 3])
        img = Image.fromarray(seg[y0:y1, x0:x1].astype(np.uint8), 'RGBA')
        img = img.resize((max(1, round(img.width * scale)), max(1, round(img.height * scale))), Image.LANCZOS)
        img.save(f'{out_dir}/{k}.webp', quality=88, method=6)
        print(k, img.size)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], float(sys.argv[3]), sys.argv[4:])
