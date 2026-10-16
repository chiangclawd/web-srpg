"""Slice a generated 5-tower family sheet into game tower frames.

Usage: python3 scripts/art/slice_towers.py <sheet.png> <orig_dir> <out_dir> key1 key2 key3 key4 key5

- Keys out the background, splits the row at the four emptiest columns
  near the expected gaps, trims each tower.
- One scale per family (median of original/new heights), so the towers keep
  the relative sizes the generator drew; bottoms line up with the original
  procedural frame's bottom; horizontally centred in the TW_W*TEX frame.
- Prints the measured anchors (logical px above the ground point) for
  TOWER_ART: the top platform rim (where archers / mages stand, and where the
  cannon barrel sits) and the top of the tower (Tesla orb).
"""
import json
import sys
import numpy as np
from PIL import Image
from key import key_array

FRAME_W, FRAME_H = 264, 320  # TW_W*TEX, TW_H*TEX
BASE_Y = 288                 # TW_BASE*TEX: ground point inside the frame
TEX = 2


def bbox(a, thr=20, min_px=4):
    """Opaque bounding box, ignoring stray specks (rows/columns with < min_px opaque pixels at the edges)."""
    m = a > thr
    rows, cols = m.sum(axis=1), m.sum(axis=0)
    ys = np.where(rows >= min_px)[0]
    xs = np.where(cols >= min_px)[0]
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def main(sheet, orig_dir, out_dir, keys):
    rgb = np.asarray(Image.open(sheet).convert('RGB')).astype(np.float32)
    rgba = key_array(rgb)
    rgba[:24, :, 3] = 0  # 生成圖左上角偶爾有小標記
    alpha = rgba[..., 3].astype(np.int32)
    w = rgba.shape[1]
    col = (alpha > 20).sum(axis=0)
    cuts = [0]
    for i in range(1, 5):
        # 在預期位置附近找「最寬的空白欄」切在正中間（避免切到旁邊那座塔的旗子）
        c = int(w * i / 5)
        lo, hi = c - w // 10, c + w // 10
        low = col[lo:hi] <= col[lo:hi].min()
        best, run_start, best_c = 0, None, c
        for j, v in enumerate(list(low) + [False]):
            if v and run_start is None:
                run_start = j
            elif not v and run_start is not None:
                if j - run_start > best:
                    best, best_c = j - run_start, lo + (run_start + j) // 2
                run_start = None
        cuts.append(best_c)
    cuts.append(w)
    pieces, origs = [], []
    for i, k in enumerate(keys):
        seg = rgba[:, cuts[i]:cuts[i + 1]].copy()
        x0, y0, x1, y1 = bbox(seg[..., 3])
        pieces.append(Image.fromarray(seg[y0:y1, x0:x1].copy(), 'RGBA'))
        o = np.asarray(Image.open(f'{orig_dir}/{k}.png').convert('RGBA'))[..., 3]
        origs.append(bbox(o))
    scale = float(np.median([(o[3] - o[1]) / p.height for o, p in zip(origs, pieces)]))
    anchors = {}
    for k, p, o in zip(keys, pieces, origs):
        s = min(scale, (FRAME_W - 6) / p.width, (o[3] - 2) / p.height)
        nw, nh = max(1, round(p.width * s)), max(1, round(p.height * s))
        img = p.resize((nw, nh), Image.LANCZOS)
        # 底座下方的柔和陰影混到洋紅底色，去背後會留一圈粉紅：只在塔的最下方 14%、半透明且偏洋紅的像素清掉
        arr = np.asarray(img).copy()
        r, g, b, al = (arr[..., i].astype(np.int32) for i in range(4))
        pink = (r - g > 40) & (b - g > 25) & (al < 250)
        pink[: int(nh * 0.86)] = False
        arr[pink, 3] = 0
        img = Image.fromarray(arr, 'RGBA')
        frame = Image.new('RGBA', (FRAME_W, FRAME_H), (0, 0, 0, 0))
        top = o[3] - nh
        frame.alpha_composite(img, ((FRAME_W - nw) // 2, top))
        frame.save(f'{out_dir}/{k}.webp', 'WEBP', quality=90, method=6)
        a = np.asarray(frame)[..., 3]
        rows = (a > 60).sum(axis=1)
        body = rows[top:].max()
        rim = next(y for y in range(top, FRAME_H) if rows[y] >= 0.6 * body)
        anchors[k] = {'rim': round((BASE_Y - rim) / TEX), 'top': round((BASE_Y - top) / TEX), 'scale': round(s, 3)}
    print(json.dumps(anchors))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4:9])
