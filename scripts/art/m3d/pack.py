# 把 render.mjs 輸出的動作條（<anim>_<yaw>.png）裁掉透明邊、緊密排成一張圖 + Phaser atlas JSON
# python3 pack.py <strips-dir> <out.webp> <dirs json> <anims json> [sharpen json]（由 render.mjs 呼叫）
#   dirs:  {"side": 45, "front": 15, "back": 165}
#   anims: ["idle","walk","attack","hit","death"]
# 格子編號 = (方向序 × 動作數 + 動作序) × cols + 第幾格，跟 src/td/view/Sheets.ts 的 sheetFrame 一致。
# 背面不渲染倒地（遊戲裡改用側面），省下一列。
import json, os, sys
from PIL import Image, ImageFilter

src, out, dirs, anims = sys.argv[1], sys.argv[2], json.loads(sys.argv[3]), json.loads(sys.argv[4])
# 銳化 [半徑, 強度%]（高解析度的英雄圖表用，讓貼圖細節像手繪線條一樣清楚）
SHARPEN = json.loads(sys.argv[5]) if len(sys.argv) > 5 else None
info = json.load(open(f'{src}/frame.json'))
size = info['w']
PAD = 2  # 格子之間留透明邊，縮放取樣時不會吃到隔壁
frames = {a: Image.open(f'{src}/{a}_{dirs[next(iter(dirs))]}.png').width // size for a in anims}
cols = max(frames.values())

cells = []  # (name, image, trim box)
for di, (d, yaw) in enumerate(dirs.items()):
    for ai, a in enumerate(anims):
        if d == 'back' and a == 'death':
            continue
        strip = Image.open(f'{src}/{a}_{yaw}.png').convert('RGBA')
        for f in range(frames[a]):
            cell = strip.crop((f * size, 0, f * size + size, size))
            box = cell.getbbox() or (0, 0, 1, 1)
            name = str((di * len(anims) + ai) * cols + f)
            cut = cell.crop(box)
            if SHARPEN:
                r, g, bl, al = cut.split()
                rgb = Image.merge('RGB', (r, g, bl)).filter(ImageFilter.UnsharpMask(radius=SHARPEN[0], percent=SHARPEN[1], threshold=2))
                cut = Image.merge('RGBA', (*rgb.split(), al))
            cells.append((name, cut, box))

def shelf(width):
    """由高到矮一排一排擺；回傳每格位置與總高"""
    order = sorted(cells, key=lambda c: -c[1].height)
    x = y = row_h = 0
    pos = {}
    for name, im, _ in order:
        w, h = im.width + PAD, im.height + PAD
        if x + w > width:
            x, y, row_h = 0, y + row_h, 0
        pos[name] = (x, y)
        x += w
        row_h = max(row_h, h)
    return pos, y + row_h

best = None
for width in (768, 1024, 1280, 1536, 2048, 3072, 4096):
    pos, height = shelf(width)
    if height > 4096:
        continue
    if best is None or width * height < best[0] * best[2]:
        best = (width, pos, height)
width, pos, height = best
atlas = Image.new('RGBA', (width, height), (0, 0, 0, 0))
json_frames = {}
for name, im, box in cells:
    x, y = pos[name]
    atlas.paste(im, (x, y))
    json_frames[name] = {
        'frame': {'x': x, 'y': y, 'w': im.width, 'h': im.height},
        'rotated': False,
        'trimmed': True,
        'spriteSourceSize': {'x': box[0], 'y': box[1], 'w': im.width, 'h': im.height},
        'sourceSize': {'w': size, 'h': size},
    }
atlas.save(out, 'WEBP', quality=88, method=6)
base = os.path.splitext(out)[0]
with open(base + '.json', 'w') as fp:
    json.dump({'frames': json_frames, 'meta': {'image': os.path.basename(out), 'size': {'w': width, 'h': height}, 'scale': '1'}}, fp, separators=(',', ':'))
print(json.dumps({'size': size, 'cols': cols, 'footAt': info['footAt'], 'unitPx': round(info['unitPx'], 1), 'cycle': round(info.get('cycle') or 1.0, 3), 'frames': frames}))
print('atlas', atlas.size, f'{len(cells)} frames', f'{width * height / (cols * size * size * len(dirs) * len(anims)):.0%} of a full grid')
