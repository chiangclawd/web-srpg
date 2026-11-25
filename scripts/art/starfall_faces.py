"""立繪的表情差分，第二步：把生成的圖的「臉」貼回原本的立繪。

生成的圖（scripts/art/starfall-faces.mjs）會把整張重畫一次，身體的線條跟原圖差一兩個像素，整張換上去的話
對話時切表情身體會抖。所以身體留原圖，只換臉：在 faces.json 給的臉部範圍裡，找出跟原圖不一樣的地方，
往外擴一點、邊緣羽化，從生成的圖取那一塊。輸出的圖跟原本的立繪一樣大，透明度也沿用原圖。

用法：py scripts/art/starfall_faces.py <原圖資料夾> [誰[:表情] ...] [--preview=<資料夾>] [--whole]
  輸出 public/assets/starfall/pt_<誰>_<表情>.webp；--preview 另外存一張每個角色的對照圖（原圖 + 各表情 + 臉部放大）。
  --whole 不貼臉，整張換（比較用，不寫進 public）。
"""
import json
import os
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
ASSETS = os.path.join(ROOT, 'public', 'assets', 'starfall')

# 跟 starfall-faces.mjs 的 CANVAS / placement 一致：參考圖怎麼放，生成的圖就怎麼對回去
CANVAS_W, CANVAS_H, MAX_H, MAX_W = 900, 1200, 1110, 880

T_CHANGED = 26.0  # 顏色差超過這個算「變了」
GROW = 15  # 變了的地方往外擴（MaxFilter 的大小，奇數）
SHRINK = 5  # 再縮回來一點，補洞用
FEATHER = 2.2


def placement(w, h):
    s = min(MAX_H / h, MAX_W / w)
    bw, bh = int(w * s + 0.5), int(h * s + 0.5)  # 跟 JS 的 Math.round 一樣（Python 的 round 遇到 .5 會取偶數）
    return int((CANVAS_W - bw) / 2 + 0.5), CANVAS_H - bh, bw, bh


def to_frame(raw_path, size):
    """生成的圖 → 原本立繪的座標和大小（RGB float）。"""
    raw = Image.open(raw_path).convert('RGB').resize((CANVAS_W, CANVAS_H), Image.LANCZOS)
    left, top, bw, bh = placement(*size)
    return np.asarray(raw.crop((left, top, left + bw, top + bh)).resize(size, Image.LANCZOS)).astype(np.float32)


def fit_colour(new, orig, ok):
    """生成的圖整體顏色會偏一點：用沒變的地方算每個色版的線性修正。"""
    out = new.copy()
    coef = []
    for c in range(3):
        x, y = new[..., c][ok], orig[..., c][ok]
        if x.size < 500:
            coef.append((1.0, 0.0))
            continue
        a, b = np.polyfit(x, y, 1)
        a = float(np.clip(a, 0.85, 1.15))
        b = float(np.clip(b, -20, 20))
        out[..., c] = np.clip(new[..., c] * a + b, 0, 255)
        coef.append((round(a, 3), round(b, 1)))
    return out, coef


def patch(who, face, raw_dir, box, whole=False):
    orig_img = Image.open(os.path.join(ASSETS, f'pt_{who}.webp')).convert('RGBA')
    W, H = orig_img.size
    orig = np.asarray(orig_img).astype(np.float32)
    rgb, alpha = orig[..., :3], orig[..., 3]
    new = to_frame(os.path.join(raw_dir, f'{who}-{face}.png'), (W, H))

    solid = np.asarray(Image.fromarray((alpha >= 250).astype(np.uint8) * 255).filter(ImageFilter.MinFilter(7))) > 0
    dist0 = np.sqrt(((new - rgb) ** 2).sum(axis=2))
    new, coef = fit_colour(new, rgb, solid & (dist0 < 30))
    dist = np.sqrt(((new - rgb) ** 2).sum(axis=2))

    # 身體對得上嗎：臉以外、不透明的地方，差很多的像素佔幾成（線條抖動大約 5% 上下；整個人被重新構圖會高很多）
    ell = Image.new('L', (W, H), 0)
    ImageDraw.Draw(ell).ellipse((box[0] * W, box[1] * H, box[2] * W, box[3] * H), fill=255)
    in_face = np.asarray(ell) > 0
    body_off = float((dist[solid & ~in_face] > 40).mean())

    if whole:
        mask = np.where(solid, 1.0, 0.0).astype(np.float32)
    else:
        # 生成的圖在這一格是背景色（臉的輪廓往內縮了）就不取
        magenta = (new[..., 0] > 170) & (new[..., 2] > 170) & (new[..., 1] < 110)
        changed = (dist > T_CHANGED) & solid & in_face & ~magenta
        m = Image.fromarray(changed.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(GROW)).filter(ImageFilter.MinFilter(SHRINK))
        m = np.asarray(m).astype(np.float32) / 255
        m *= np.asarray(ell.filter(ImageFilter.GaussianBlur(3))).astype(np.float32) / 255
        m = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(FEATHER))).astype(np.float32) / 255
        mask = m * solid * ~magenta

    out = rgb * (1 - mask[..., None]) + new * mask[..., None]
    img = Image.fromarray(np.dstack([out, alpha]).astype(np.uint8), 'RGBA')
    info = {'who': who, 'face': face, 'size': [W, H], 'colour': coef, 'body_off': round(body_off, 3), 'mask': round(float((mask > 0.5).mean()), 3), 'face_changed': round(float((dist[in_face & solid] > 40).mean()), 3)}
    return img, info


def preview(who, items, box, out_path):
    """原圖 + 各表情，上排全身、下排臉部放大。"""
    orig = Image.open(os.path.join(ASSETS, f'pt_{who}.webp')).convert('RGBA')
    W, H = orig.size
    cells = [('original', orig)] + items
    fx0, fy0, fx1, fy1 = box
    pad = 0.04
    crop = (int(max(0, fx0 - pad) * W), int(max(0, fy0 - pad) * H), int(min(1, fx1 + pad) * W), int(min(1, fy1 + pad) * H))
    cw, ch = crop[2] - crop[0], crop[3] - crop[1]
    zoom = W / cw
    zh = round(ch * zoom)
    sheet = Image.new('RGB', (len(cells) * (W + 8) + 8, 30 + H + 8 + zh + 8), (42, 51, 64))
    d = ImageDraw.Draw(sheet)
    for i, (label, im) in enumerate(cells):
        x = 8 + i * (W + 8)
        d.text((x + 4, 8), f'{who} {label}', fill=(232, 238, 245))
        bg = Image.new('RGBA', (W, H), (42, 51, 64, 255))
        bg.alpha_composite(im)
        sheet.paste(bg.convert('RGB'), (x, 30))
        sheet.paste(bg.convert('RGB').crop(crop).resize((W, zh), Image.LANCZOS), (x, 30 + H + 8))
    sheet.save(out_path)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    flags = [a for a in sys.argv[1:] if a.startswith('--')]
    if not args:
        print(__doc__)
        sys.exit(2)
    raw_dir, only = args[0], args[1:]
    whole = '--whole' in flags
    prev = next((f.split('=', 1)[1] for f in flags if f.startswith('--preview=')), None)
    with open(os.path.join(HERE, 'prompts', 'starfall', 'faces.json'), encoding='utf8') as f:
        spec = json.load(f)
    for who, s in spec.items():
        items = []
        for face in s['faces']:
            if only and who not in only and f'{who}:{face}' not in only:
                continue
            if not os.path.exists(os.path.join(raw_dir, f'{who}-{face}.png')):
                print(f'missing raw: {who}:{face}')
                continue
            img, info = patch(who, face, raw_dir, s['face'], whole)
            if not whole:
                out = os.path.join(ASSETS, f'pt_{who}_{face}.webp')
                img.save(out, 'WEBP', quality=90, method=6)
                info['bytes'] = os.path.getsize(out)
            print(json.dumps(info))
            items.append((face, img))
        if prev and items:
            os.makedirs(prev, exist_ok=True)
            preview(who, items, s['face'], os.path.join(prev, f'{who}{"-whole" if whole else ""}.png'))


if __name__ == '__main__':
    main()
