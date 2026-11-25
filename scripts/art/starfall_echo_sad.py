"""艾可「難過」的表情：不是生成的，是從另外兩個表情算出來的。

Gemini 的內容過濾一直把這一張擋掉（換了三種描述都一樣，包括只講幾何形狀的），而艾可的眼睛只是深色玻璃上
兩個發光的形狀，所以直接畫：
  1. 原圖（彎彎的笑眼）、calm（橢圓）、alert（圓環）三張裡發過光的地方整塊挖掉，用周圍玻璃的顏色補平，得到沒有眼睛的玻璃；
  2. 從 calm 量出兩隻眼睛的位置和大小、發光的顏色；
  3. 在同樣的位置畫半個橢圓，上緣是斜的（內側高、外側低），加一圈光暈。

用法：py scripts/art/starfall_echo_sad.py     （要先有 pt_echo_calm.webp、pt_echo_alert.webp）
"""
import json
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.normpath(os.path.join(HERE, '..', '..', 'public', 'assets', 'starfall'))
SS = 4  # 畫形狀時放大幾倍再縮回來，邊緣才平滑


def load(name):
    return np.asarray(Image.open(os.path.join(ASSETS, name)).convert('RGBA')).astype(np.float32)


def components(mask):
    """四連通的區塊，回傳每塊的 (面積, x0, y0, x1, y1)。圖很小，用簡單的填色法就夠。"""
    h, w = mask.shape
    seen = np.zeros_like(mask, bool)
    out = []
    for y0, x0 in zip(*np.where(mask)):
        if seen[y0, x0]:
            continue
        stack = [(y0, x0)]
        seen[y0, x0] = True
        xs, ys = [], []
        while stack:
            y, x = stack.pop()
            xs.append(x)
            ys.append(y)
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    stack.append((ny, nx))
        out.append((len(xs), min(xs), min(ys), max(xs) + 1, max(ys) + 1))
    return sorted(out, reverse=True)


def main():
    with open(os.path.join(HERE, 'prompts', 'starfall', 'faces.json'), encoding='utf8') as f:
        box = json.load(f)['echo']['face']
    base, calm, alert = load('pt_echo.webp'), load('pt_echo_calm.webp'), load('pt_echo_alert.webp')
    H, W = base.shape[:2]
    ell = Image.new('L', (W, H), 0)
    ImageDraw.Draw(ell).ellipse((box[0] * W, box[1] * H, box[2] * W, box[3] * H), fill=255)
    face = np.asarray(ell) > 0

    # 1. 沒有眼睛的玻璃：三張裡任何一張發過光的地方（往外多留 12 像素，光暈也算進去）用周圍玻璃的顏色蓋掉。
    #    玻璃上的顏色變化很平緩，每隻眼睛各自擬合一個平面就夠；蓋的範圍邊緣是漸層的，才不會留下一圈接縫。
    #    （只取「三張裡最暗的」不夠：新的眼睛畫在原本笑眼的位置上，三張都亮的地方會留下殘影。）
    def cyan(im):
        return (im[..., 1] + im[..., 2]) / 2 - im[..., 0]

    def grow(mask, size):
        return np.asarray(Image.fromarray(mask.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(size))) > 0

    def blur(arr, r):
        return np.asarray(Image.fromarray(np.clip(arr * 255, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))).astype(np.float32) / 255

    lit = (np.max([cyan(base), cyan(calm), cyan(alert)], axis=0) > 80) & face
    core = grow(lit, 25) & face
    wide = grow(core, 17) & face
    cover = np.maximum(blur(wide.astype(np.float32), 4), core.astype(np.float32)) * face
    # 玻璃上的反光離左眼很近：亮但不是青色的地方不蓋
    total = base[..., :3].sum(axis=2)
    # （眼睛光暈的外緣也是「亮但不太青」，所以緊貼著眼睛的 10 像素內不算反光）
    shine = (total > np.median(total[face]) + 45) & (cyan(base) < 55) & ~grow(lit, 21)
    cover *= 1 - blur(grow(shine, 5).astype(np.float32), 1.5)
    around = grow(wide, 61) & face & ~wide & ~grow(shine, 9)
    fill = base[..., :3].copy()
    yy, xx = np.mgrid[0:H, 0:W]
    for _, x0, y0, x1, y1 in components(wide):
        near = around & (xx >= x0 - 30) & (xx < x1 + 30) & (yy >= y0 - 30) & (yy < y1 + 30)
        here = wide & (xx >= x0) & (xx < x1) & (yy >= y0) & (yy < y1)
        # 那一圈裡混到邊框的話會把顏色帶偏：只用接近中位數的像素
        near &= np.abs(total - np.median(total[near])) < 18
        A = np.stack([np.ones(near.sum()), xx[near], yy[near]], axis=1).astype(np.float64)
        B = np.stack([np.ones(here.sum()), xx[here], yy[here]], axis=1).astype(np.float64)
        for c in range(3):
            coef, *_ = np.linalg.lstsq(A, base[..., c][near].astype(np.float64), rcond=None)
            fill[..., c][here] = np.clip(B @ coef, 0, 255)
    blank = base[..., :3] * (1 - cover[..., None]) + fill * cover[..., None]

    # 2. 從 calm 量眼睛
    eye = (cyan(calm) > 120) & face
    eyes = sorted(components(eye)[:2], key=lambda c: c[1])
    colour = np.percentile(calm[..., :3][eye].reshape(-1, 3), 80, axis=0)  # 眼睛中間的顏色（邊緣比較暗）
    print('eyes', [tuple(int(v) for v in e) for e in eyes], 'colour', colour.round().tolist())

    # 3. 畫：半個橢圓，上緣斜切，內側高、外側低
    shape = Image.new('L', (W * SS, H * SS), 0)
    mid = (eyes[0][1] + eyes[0][3] + eyes[1][1] + eyes[1][3]) / 4
    for _, x0, y0, x1, y1 in eyes:
        w, h = x1 - x0, y1 - y0
        cx = (x0 + x1) / 2
        # 比 calm 的橢圓寬一點、矮一點，看起來像垂下來的眼睛
        ex0, ex1 = cx - w * 0.62, cx + w * 0.62
        ey0, ey1 = y0 + h * 0.16, y1 - h * 0.02
        one = Image.new('L', (W * SS, H * SS), 0)
        ImageDraw.Draw(one).ellipse((ex0 * SS, ey0 * SS, ex1 * SS, ey1 * SS), fill=255)
        inner_high, outer_low = ey0 + (ey1 - ey0) * 0.22, ey0 + (ey1 - ey0) * 0.60
        outer_is_left = cx < mid
        ya, yb = (outer_low, inner_high) if outer_is_left else (inner_high, outer_low)  # 左端、右端的切線高度
        cut = Image.new('L', (W * SS, H * SS), 0)
        ImageDraw.Draw(cut).polygon([((ex0 - 4) * SS, ya * SS), ((ex1 + 4) * SS, yb * SS), ((ex1 + 4) * SS, (ey1 + 4) * SS), ((ex0 - 4) * SS, (ey1 + 4) * SS)], fill=255)
        shape = Image.fromarray(np.maximum(np.asarray(shape), np.minimum(np.asarray(one), np.asarray(cut))))
    core = np.asarray(shape.resize((W, H), Image.LANCZOS)).astype(np.float32) / 255
    core = np.asarray(Image.fromarray((core * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))).astype(np.float32) / 255
    halo = np.asarray(Image.fromarray((core * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(5))).astype(np.float32) / 255
    a = np.clip(np.maximum(core, halo * 0.6), 0, 1)[..., None] * face[..., None]
    out = blank * (1 - a) + colour * 0.93 * a  # 比平常暗一點

    img = Image.fromarray(np.dstack([out, base[..., 3]]).astype(np.uint8), 'RGBA')
    path = os.path.join(ASSETS, 'pt_echo_sad.webp')
    img.save(path, 'WEBP', quality=90, method=6)
    print(path, os.path.getsize(path), 'bytes')


if __name__ == '__main__':
    main()
