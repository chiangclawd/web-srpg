# 《星墜殘響》的內嵌字型：從思源黑體（Noto Sans TC）裡只取遊戲用到的字，存成 woff2。
#   npm run starfall:font-chars                                  先更新字表（scripts/art/fonts/starfall-chars.txt）
#   py scripts/art/fonts/starfall_font.py <放原始字型的資料夾>      需要 fonttools 和 brotli（pip install fonttools brotli）
# 原始字型：NotoSansTC_400Regular.ttf 和 NotoSansTC_700Bold.ttf（各 7 MB，不放進版本庫）。
# 從 Google Fonts 下載 Noto Sans TC，或 `npm pack @expo-google-fonts/noto-sans-tc` 解開來拿。
# 授權是 SIL Open Font License 1.1，可以商用、可以取子集；授權全文跟字型檔放在一起（OFL.txt）。
import os, shutil, sys
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
SRC = sys.argv[1]
OUT = os.path.join(ROOT, 'public', 'assets', 'starfall', 'fonts')
os.makedirs(OUT, exist_ok=True)

with open(os.path.join(ROOT, 'scripts', 'art', 'fonts', 'starfall-chars.txt'), encoding='utf-8') as fp:
    chars = fp.read().rstrip('\n')

for weight, name in ((400, 'NotoSansTC_400Regular.ttf'), (700, 'NotoSansTC_700Bold.ttf')):
    opt = subset.Options()
    opt.flavor = 'woff2'
    opt.hinting = False              # 畫在 canvas 上、又會被縮放，用不到；省掉可以小很多
    opt.desubroutinize = True
    opt.layout_features = ['kern', 'liga', 'locl', 'palt']
    opt.name_IDs = [1, 2, 3, 4, 6]
    opt.notdef_outline = True
    opt.drop_tables += ['DSIG', 'vhea', 'vmtx', 'VORG']
    font = TTFont(os.path.join(SRC, name))
    cmap = font.getBestCmap()
    missing = [c for c in chars if ord(c) not in cmap]
    sub = subset.Subsetter(opt)
    sub.populate(text=chars)
    sub.subset(font)
    path = os.path.join(OUT, f'starfall-sans-{weight}.woff2')
    font.save(path)
    # 缺的字印成碼位（Windows 的主控台不一定印得出那個字）；這些字在遊戲裡會退回系統字型
    print(f'{weight}: {len(chars)} characters, {os.path.getsize(path) // 1024} KB' + (f', not in the source font: {" ".join(f"U+{ord(c):04X}" for c in missing)}' if missing else ''))

lic = os.path.join(SRC, 'LICENSE_FONT')
if os.path.exists(lic):
    shutil.copyfile(lic, os.path.join(OUT, 'OFL.txt'))
