# 把 starfall_tiles.py 渲染出來的地塊排成一張圖 + Phaser atlas JSON。
#   py scripts/art/tiles/pack_tiles.py <渲染資料夾> public/assets/starfall/tiles.webp
# 側面往下淡出到透明（跟原本程式畫的一樣，棋盤看起來像懸空的模型台）。格子名稱 = tile_<地形>_<花樣>。
import json, os, sys
import numpy as np
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
W, H = 192, 480
FADE_FROM, FADE_TO = 232, 472   # 頂面菱形的下緣在 y = 216；從這底下開始淡出
names = sorted(f[:-4] for f in os.listdir(src) if f.startswith('tile_') and f.endswith('.png'))
cols = 8
rows = (len(names) + cols - 1) // cols
atlas = Image.new('RGBA', (cols * W, rows * H), (0, 0, 0, 0))
t = np.clip((np.arange(H) - FADE_FROM) / (FADE_TO - FADE_FROM), 0, 1)
fade = ((1 - t) ** 1.25)[:, None]
frames = {}
for i, n in enumerate(names):
    im = np.asarray(Image.open(f'{src}/{n}.png').convert('RGBA')).astype(np.float32)
    assert im.shape[:2] == (H, W), n
    im[..., 3] *= fade
    x, y = (i % cols) * W, (i // cols) * H
    atlas.paste(Image.fromarray(im.round().astype(np.uint8), 'RGBA'), (x, y))
    frames[n] = {'frame': {'x': x, 'y': y, 'w': W, 'h': H}, 'rotated': False, 'trimmed': False, 'spriteSourceSize': {'x': 0, 'y': 0, 'w': W, 'h': H}, 'sourceSize': {'w': W, 'h': H}}
atlas.save(out, 'WEBP', quality=90, method=6)
with open(os.path.splitext(out)[0] + '.json', 'w') as fp:
    json.dump({'frames': frames, 'meta': {'image': os.path.basename(out), 'size': {'w': atlas.width, 'h': atlas.height}, 'scale': '1'}}, fp, separators=(',', ':'))
print(len(names), 'tiles', atlas.size, f'{os.path.getsize(out) // 1024} KB')
