"""Make WebP copies of the PNG sprites and portraits the tower-defense game loads at boot.

    python3 scripts/art/td_webp.py

The SRPG keeps using the PNGs; the TD build loads these .webp files instead
(about half the size, so the first load on a phone is ~1.5 MB lighter).
"""
import re
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
boot = (ROOT / 'src/td/scenes/BootScene.ts').read_text()
story = (ROOT / 'src/td/data/story.ts').read_text()
heroes = (ROOT / 'src/td/data/heroes.ts').read_text()

block = boot[boot.index('const SPRITES = ['):]
sprites = re.findall(r"'([a-z_]+)'", block[: block.index('];')])
portraits = re.findall(r"'([a-z_]+)'", story[story.index('STORY_PORTRAITS = ['):].split(']')[0])
portraits += re.findall(r"portrait: 'pt_([a-z_]+)'", heroes)

for folder, names in (('sprites', sprites), ('portraits', sorted(set(portraits)))):
    for n in names:
        src = ROOT / f'public/assets/{folder}/{n}.png'
        out = src.with_suffix('.webp')
        Image.open(src).save(out, 'WEBP', quality=90, method=6, alpha_quality=100)
        print(f'{folder}/{n}: {src.stat().st_size // 1024}K -> {out.stat().st_size // 1024}K')
