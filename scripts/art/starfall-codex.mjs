// 《星墜殘響》圖鑑用的機體圖：從每張機體圖表裁出「待機、正面朝右」的第一格，排成一張小圖集。
//   node scripts/art/starfall-codex.mjs
// 讀 public/assets/starfall/units/*.webp + *.json，寫出 public/assets/starfall/codex.webp + codex.json（Phaser atlas）。
// 圖鑑一次要顯示全部二十幾種機體；整張圖表一張就是 2048×1100，全部載進來手機吃不消，所以另外做這一張（約 1000×700）。
// 重新渲染過機體圖表之後要再跑一次。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = path.join(ROOT, 'public/assets/starfall/units');
const OUT = path.join(ROOT, 'public/assets/starfall');
const MAX_W = 1024;
const PAD = 2;

const cells = [];
for (const file of fs.readdirSync(SRC).filter((f) => f.endsWith('.json')).sort()) {
  const key = path.basename(file, '.json');
  const atlas = JSON.parse(fs.readFileSync(path.join(SRC, file), 'utf8'));
  // 第 0 格 = 第一組方向（正面朝右）的第一個動作（待機）的第一格，見 src/starfall/view/sheets.ts 的 frameName
  const f = atlas.frames['0']?.frame;
  if (!f) throw new Error(`${file}: no frame 0`);
  const buf = await sharp(path.join(SRC, `${key}.webp`)).extract({ left: f.x, top: f.y, width: f.w, height: f.h }).png().toBuffer();
  cells.push({ key, w: f.w, h: f.h, buf });
}

// 高的先排，一列排滿換下一列
cells.sort((a, b) => b.h - a.h || a.key.localeCompare(b.key));
let x = PAD;
let y = PAD;
let rowH = 0;
let width = 0;
for (const c of cells) {
  if (x + c.w + PAD > MAX_W) {
    x = PAD;
    y += rowH + PAD;
    rowH = 0;
  }
  c.x = x;
  c.y = y;
  x += c.w + PAD;
  rowH = Math.max(rowH, c.h);
  width = Math.max(width, x);
}
const height = y + rowH + PAD;

await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite(cells.map((c) => ({ input: c.buf, left: c.x, top: c.y })))
  .webp({ quality: 92, alphaQuality: 100, effort: 6 })
  .toFile(path.join(OUT, 'codex.webp'));

const frames = {};
for (const c of [...cells].sort((a, b) => a.key.localeCompare(b.key))) {
  frames[c.key] = { frame: { x: c.x, y: c.y, w: c.w, h: c.h }, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: c.w, h: c.h }, sourceSize: { w: c.w, h: c.h } };
}
fs.writeFileSync(path.join(OUT, 'codex.json'), JSON.stringify({ frames, meta: { image: 'codex.webp', size: { w: width, h: height }, scale: '1' } }));
console.log(`${cells.length} units -> codex.webp ${width}x${height}, ${Math.round(fs.statSync(path.join(OUT, 'codex.webp')).size / 1024)} KB`);
