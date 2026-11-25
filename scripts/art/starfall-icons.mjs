// 《星墜殘響》網頁版的主畫面圖示：從主視覺（title.webp）裁出凱的機體，四角壓暗。
//   node scripts/art/starfall-icons.mjs
// 產出 public/starfall-icon-{180,192,512}.png（整張都會顯示）和 starfall-icon-maskable-512.png
// （Android 會把它裁成圓形或圓角方形，所以裁寬一點，機體留在中間八成的安全範圍裡）。
// 這是先頂著用的圖示；之後要是另外畫一張，換掉這裡的來源就好。
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = path.join(root, 'public/assets/starfall/title.webp');
// 來源是 1600×893：白色機體大約在 x 947–1220、y 413–816
const CROPS = {
  any: { left: 827, top: 333, size: 507 },
  maskable: { left: 776, top: 273, size: 613 },
};

function vignette(size, strength) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><defs><radialGradient id="g" cx="50%" cy="50%" r="72%">` +
      `<stop offset="55%" stop-color="#040a14" stop-opacity="0"/><stop offset="100%" stop-color="#040a14" stop-opacity="${strength}"/>` +
      `</radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`,
  );
}

async function icon(kind, size, file) {
  const c = CROPS[kind];
  await sharp(src)
    .extract({ left: c.left, top: c.top, width: c.size, height: c.size })
    .resize(size, size, { kernel: 'lanczos3' })
    .composite([{ input: vignette(size, kind === 'any' ? 0.7 : 0.4) }])
    // 256 色加抖色：512 的圖從 590 KB 降到一百多 KB，縮到圖示的大小看不出差別
    .png({ palette: true, colours: 256, dither: 1, effort: 10 })
    .toFile(path.join(root, 'public', file));
  console.log(file);
}

await icon('any', 180, 'starfall-icon-180.png');
await icon('any', 192, 'starfall-icon-192.png');
await icon('any', 512, 'starfall-icon-512.png');
await icon('maskable', 512, 'starfall-icon-maskable-512.png');
