"""生成的插圖裡跟劇本對不上的小地方，用程式改掉（不重新生成）。

    py scripts/art/starfall_cg_fix.py <原圖資料夾>

改的是原圖資料夾裡的原圖（2752x1536），改之前那一張另存成 <名字>.orig.png，重跑會從那一張重新改。
改完再跑 node scripts/art/starfall-cg.mjs <原圖資料夾> --ship。

- landing：台詞說站到我方這邊的機群「眼睛是藍色的」，生成的圖把哨兵和織網者的眼睛畫成紅的。
  把那兩處的紅色（連同旁邊的紅暈）轉成藍色，其餘不動。
"""
import colorsys
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image

# 每一處：(左, 上, 右, 下)，原圖的像素
RED_TO_BLUE = {
    'landing': [(1138, 946, 1162, 970), (1778, 1030, 1816, 1066)],
}
BLUE_HUE = 200 / 360


def red_to_blue(im: Image.Image, boxes) -> int:
    px = np.asarray(im.convert('RGB'), dtype=np.float32) / 255
    n = 0
    for x0, y0, x1, y1 in boxes:
        for y in range(y0, y1):
            for x in range(x0, x1):
                h, s, v = colorsys.rgb_to_hsv(*px[y, x])
                # 紅色：色相在 0 度左右 45 度以內（眼睛中心偏橘、邊緣的暈偏暗紅都算），框裡其餘的是灰和青色
                if min(h, 1 - h) < 45 / 360 and s > 0.15 and v > 0.06:
                    px[y, x] = colorsys.hsv_to_rgb(BLUE_HUE, s, v)
                    n += 1
    im.paste(Image.fromarray((px * 255 + 0.5).astype(np.uint8)))
    return n


def main() -> None:
    raw = Path(sys.argv[1])
    for name, boxes in RED_TO_BLUE.items():
        src = raw / f'{name}.png'
        orig = raw / f'{name}.orig.png'
        if not src.exists():
            print(f'{name}: no image')
            continue
        if not orig.exists():
            shutil.copyfile(src, orig)
        im = Image.open(orig).convert('RGB')
        n = red_to_blue(im, boxes)
        im.save(src)
        print(f'{name}: {n} red pixels turned blue in {len(boxes)} places')


if __name__ == '__main__':
    main()
