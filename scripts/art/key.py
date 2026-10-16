"""Key out a generated sprite's flat background, then trim and scale.

Usage: python3 scripts/art/key.py <in.png> <out.png> [target_height=256]

The background colour is taken from the image border (generators don't hit
the exact colour asked for). Only background connected to the border is
removed, so same-coloured details inside the character survive. Edges get a
soft alpha and the background tint is pulled out of them (despill).
"""
import sys
import numpy as np
from PIL import Image

T_LO, T_HI = 38.0, 105.0  # colour distance: fully transparent below, opaque above
H_LO, H_HI = 30.0, 62.0  # stricter ramp for enclosed holes not connected to the border


def key(path_in: str, path_out: str, target_h: int = 256) -> None:
    rgb = np.asarray(Image.open(path_in).convert('RGB')).astype(np.float32)
    h, w, _ = rgb.shape
    border = np.concatenate([rgb[:6].reshape(-1, 3), rgb[-6:].reshape(-1, 3), rgb[:, :6].reshape(-1, 3), rgb[:, -6:].reshape(-1, 3)])
    bg = np.median(border, axis=0)
    dist = np.sqrt(((rgb - bg) ** 2).sum(axis=2))
    cand = dist < T_HI
    # 從邊框往內長：只有和邊框相連的背景色才算背景
    mask = np.zeros_like(cand)
    mask[0, :] = cand[0, :]
    mask[-1, :] = cand[-1, :]
    mask[:, 0] = cand[:, 0]
    mask[:, -1] = cand[:, -1]
    while True:
        grown = mask.copy()
        grown[1:, :] |= mask[:-1, :]
        grown[:-1, :] |= mask[1:, :]
        grown[:, 1:] |= mask[:, :-1]
        grown[:, :-1] |= mask[:, 1:]
        grown &= cand
        if (grown == mask).all():
            break
        mask = grown
    alpha = np.ones((h, w), np.float32)
    alpha[mask] = np.clip((dist[mask] - T_LO) / (T_HI - T_LO), 0, 1)
    # 被身體圍住的背景洞（手臂與身體之間等）不和邊框相連：顏色非常接近背景才去掉，門檻較嚴
    holes = ~mask & (dist < H_HI)
    alpha[holes] = np.minimum(alpha[holes], np.clip((dist[holes] - H_LO) / (H_HI - H_LO), 0, 1))
    mask = mask | holes
    # 去背景色溢出：半透明邊緣把背景色成分扣掉
    a = alpha[..., None]
    soft = (alpha > 0.02) & (alpha < 0.999)
    out = rgb.copy()
    out[soft] = np.clip((rgb[soft] - (1 - a[soft]) * bg) / np.maximum(a[soft], 0.02), 0, 255)
    rgba = np.dstack([out, alpha * 255]).astype(np.uint8)
    img = Image.fromarray(rgba, 'RGBA')
    ys, xs = np.where(alpha > 0.05)
    pad = 6
    box = (max(0, xs.min() - pad), max(0, ys.min() - pad), min(w, xs.max() + pad + 1), min(h, ys.max() + pad + 1))
    img = img.crop(box)
    s = target_h / img.height
    img = img.resize((max(1, round(img.width * s)), target_h), Image.LANCZOS)
    img.save(path_out, optimize=True)
    print(f'{path_out}: bg={bg.round().astype(int).tolist()} size={img.size}')


if __name__ == '__main__':
    key(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 256)
