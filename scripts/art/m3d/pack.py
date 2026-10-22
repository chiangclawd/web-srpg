# 把 render.cjs 輸出的動作條（<anim>_<yaw>.png）排成遊戲用的圖表 + 數值
# python3 pack.py <strips-dir> <out.webp> <dirs json> <anims json> <durs json>（由 render.mjs 呼叫）
#   dirs:  {"side": 60, "front": 20, "back": 160}
#   anims: ["idle","walk","attack","hit","death"]
#   durs:  {"idle": 2.0, "walk": 1, "attack": 0.55, "hit": 0.3, "death": 0.9}
import json, sys
from PIL import Image

src, out, dirs, anims, durs = sys.argv[1], sys.argv[2], json.loads(sys.argv[3]), json.loads(sys.argv[4]), json.loads(sys.argv[5])
info = json.load(open(f'{src}/frame.json'))
size = info['w']
strips = {}
for d, yaw in dirs.items():
    for a in anims:
        strips[(d, a)] = Image.open(f'{src}/{a}_{yaw}.png').convert('RGBA')
frames = {a: strips[(next(iter(dirs)), a)].width // size for a in anims}
cols = max(frames.values())
rows = len(dirs) * len(anims)
atlas = Image.new('RGBA', (cols * size, rows * size), (0, 0, 0, 0))
r = 0
for d in dirs:
    for a in anims:
        atlas.paste(strips[(d, a)], (0, r * size))
        r += 1
atlas.save(out, 'WEBP', quality=88, method=6)
manifest = {
    'size': size,
    'cols': cols,
    'footAt': info['footAt'],
    'unitPx': round(info['unitPx'], 1),
    'cycle': round(info.get('cycle') or 1.0, 3),
    'anims': {a: {'frames': frames[a], 'dur': durs[a]} for a in anims},
}
print(json.dumps(manifest))
print('atlas', atlas.size)
