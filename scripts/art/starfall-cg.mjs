/**
 * 劇情插圖（CG）：照 scripts/art/prompts/starfall/cg.json 的清單，請 Gemini 畫 16:9 的全螢幕插圖。
 * 每一張的場面寫在 cg_<名字>.txt，共用的畫風和構圖要求在 _cg.txt；參考圖（主視覺、立繪、背景、圖鑑裡的機體）
 * 從遊戲現有的素材轉出來，一起送過去，機體和人物才對得上。
 *
 * 用法：
 *   node scripts/art/starfall-cg.mjs <原圖資料夾>                      # 只列出還缺哪些，不生成
 *   node scripts/art/starfall-cg.mjs <原圖資料夾> --prep               # 把參考圖和整段提示詞寫出來看，不生成
 *   node scripts/art/starfall-cg.mjs <原圖資料夾> --max=8              # 把缺的生出來，最多 8 張（要花錢）
 *   node scripts/art/starfall-cg.mjs <原圖資料夾> wake --max=1 --redo  # 重做一張（舊的改名留著）
 *   node scripts/art/starfall-cg.mjs <原圖資料夾> --ship               # 原圖縮成遊戲用的 public/assets/starfall/cg_<名字>.webp（不花錢）
 *
 * 沒有加 --max 就不會發出任何請求。已經有的圖不會重做，除非加 --redo。
 * cg.json 裡某一張寫了 "crop": { "bottom": 0.17 }，--ship 時就先裁掉下面那 17%（左右跟著各裁一點，維持 16:9）：
 * 生成的圖有時會在底部畫上一條暗帶，裁掉比重新生成省。
 * 環境變數：GEMINI_API_KEY（金鑰）、GEMINI_IMAGE_MODEL（預設 gemini-3-pro-image）、GEMINI_SIZE（預設 2K）。
 * 花費記在 <原圖資料夾>/ledger.jsonl。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const PROMPTS = path.join(HERE, 'prompts/starfall');
const ASSETS = path.join(ROOT, 'public/assets/starfall');

/** 遊戲裡全螢幕插圖的大小（跟主視覺、結局圖一樣） */
export const SHIP = { w: 1600, h: 893, quality: 84 };
/** 參考圖墊的底色：立繪和機體圖是去背的 */
const GREY = '#8c97a3';

const readPrompt = (f) => fs.readFileSync(path.join(PROMPTS, f), 'utf8').replace(/\r\n/g, '\n');

export function loadSpec() {
  return JSON.parse(readPrompt('cg.json'));
}

/** 參考圖在原圖資料夾裡的檔名 */
export const refFile = (img) => `ref-${img.replace(':', '-')}.png`;

/** 整段提示詞：場面 + 每張參考圖是拿來參考什麼的 + 共用的畫風和構圖 */
export function cgPrompt(name, spec) {
  const refs = spec[name].refs.map((r, i) => {
    const sprite = r.img.startsWith('unit:')
      ? ' This reference is a small chibi sprite from the game: keep its colours and its distinguishing features, but draw the machine with the realistic proportions of the mechs in the key art.'
      : '';
    return `${i + 1}. ${r.use}.${sprite}`;
  });
  return [
    readPrompt(`cg_${name}.txt`).trimEnd(),
    '',
    'Reference images are attached, in this order. Use them for design and style only, and draw a new picture:',
    ...refs,
    readPrompt('_cg.txt').trimEnd(),
    '',
  ].join('\n');
}

/** 從遊戲現有的素材轉出一張參考圖（PNG，去背的墊上灰底） */
async function buildRef(img, file) {
  if (img.startsWith('unit:')) {
    // 圖鑑的圖集裡切出那一台，放大四倍
    const id = img.slice(5);
    const atlas = JSON.parse(fs.readFileSync(path.join(ASSETS, 'codex.json'), 'utf8'));
    const f = atlas.frames[id]?.frame;
    if (!f) throw new Error(`codex.json has no frame "${id}"`);
    const cut = await sharp(path.join(ASSETS, 'codex.webp')).extract({ left: f.x, top: f.y, width: f.w, height: f.h }).resize(f.w * 4, f.h * 4, { kernel: 'lanczos3' }).png().toBuffer();
    const pad = 60;
    await sharp({ create: { width: f.w * 4 + pad * 2, height: f.h * 4 + pad * 2, channels: 3, background: GREY } })
      .composite([{ input: cut, left: pad, top: pad }])
      .png()
      .toFile(file);
    return;
  }
  await sharp(path.join(ASSETS, `${img}.webp`)).flatten({ background: GREY }).png().toFile(file);
}

/** 裁掉上下之後還是 16:9 的那一塊（左右置中） */
export function cropBox(w, h, crop = {}) {
  const top = Math.round(h * (crop.top ?? 0));
  const height = Math.round(h * (1 - (crop.bottom ?? 0))) - top;
  const width = Math.min(w, Math.round((height * SHIP.w) / SHIP.h));
  return { left: Math.round((w - width) / 2), top, width, height };
}

async function ship(dir, names) {
  const spec = loadSpec();
  for (const name of names) {
    const src = path.join(dir, `${name}.png`);
    if (!fs.existsSync(src)) {
      console.log(`${name}: no image yet`);
      continue;
    }
    const out = path.join(ASSETS, `cg_${name}.webp`);
    const meta = await sharp(src).metadata();
    const box = cropBox(meta.width, meta.height, spec[name].crop);
    const info = await sharp(src).extract(box).resize(SHIP.w, SHIP.h, { fit: 'cover', position: 'centre' }).webp({ quality: SHIP.quality, effort: 6 }).toFile(out);
    console.log(`cg_${name}.webp: ${meta.width}x${meta.height}${spec[name].crop ? ` (cut to ${box.width}x${box.height})` : ''} -> ${info.width}x${info.height}, ${(info.size / 1024).toFixed(0)} KB`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const flags = args.filter((a) => a.startsWith('--'));
  const [dir, ...only] = args.filter((a) => !a.startsWith('--'));
  if (!dir) {
    console.error('usage: starfall-cg.mjs <raw-dir> [name ...] [--prep | --max=<n> [--redo] | --ship]');
    process.exit(2);
  }
  const spec = loadSpec();
  const unknown = only.filter((n) => !spec[n]);
  if (unknown.length) {
    console.error(`not in cg.json: ${unknown.join(' ')}`);
    process.exit(2);
  }
  const names = Object.keys(spec).filter((n) => !only.length || only.includes(n));
  fs.mkdirSync(dir, { recursive: true });
  if (flags.includes('--ship')) return ship(dir, names);

  const max = Number(flags.find((f) => f.startsWith('--max='))?.slice(6) ?? 0);
  const redo = flags.includes('--redo');
  const prep = flags.includes('--prep');
  const jobs = names.map((name) => ({ name, out: path.join(dir, `${name}.png`) })).map((j) => ({ ...j, have: fs.existsSync(j.out) }));
  const todo = jobs.filter((j) => !j.have || redo);
  const model = process.env.GEMINI_IMAGE_MODEL ?? 'gemini-3-pro-image';
  const size = process.env.GEMINI_SIZE ?? '2K';
  console.log(`${todo.length} to generate with ${model} at ${size}: ${todo.map((j) => j.name).join(' ') || '(none)'}`);

  // 參考圖和提示詞先寫出來（不花錢），--prep 就停在這裡
  for (const j of prep ? jobs : todo.slice(0, max || 0)) {
    for (const r of spec[j.name].refs) {
      const f = path.join(dir, refFile(r.img));
      if (!fs.existsSync(f)) await buildRef(r.img, f);
    }
    fs.writeFileSync(path.join(dir, `${j.name}.txt`), cgPrompt(j.name, spec));
  }
  if (prep) {
    console.log(`prompts and reference images written to ${dir}; nothing sent`);
    return;
  }
  if (!max) {
    if (todo.length) console.log('nothing sent: pass --max=<n> to generate');
    return;
  }

  let sent = 0;
  let failed = 0;
  for (const j of todo) {
    if (sent >= max) {
      console.log(`stopped at --max=${max}; ${todo.length - sent} left`);
      break;
    }
    if (j.have) {
      // 重做：舊的留著，方便比較
      let n = 1;
      while (fs.existsSync(path.join(dir, `${j.name}.old${n}.png`))) n++;
      fs.renameSync(j.out, path.join(dir, `${j.name}.old${n}.png`));
    }
    sent++;
    const refs = spec[j.name].refs.map((r) => path.join(dir, refFile(r.img)));
    const r = spawnSync(process.execPath, [path.join(HERE, 'gemini-image.mjs'), j.out, path.join(dir, `${j.name}.txt`), ...refs], {
      stdio: 'inherit',
      env: { ...process.env, GEMINI_IMAGE_MODEL: model, GEMINI_ASPECT: '16:9', GEMINI_SIZE: size, ART_LEDGER: path.join(dir, 'ledger.jsonl') },
    });
    if (r.status !== 0) {
      failed++;
      console.log(`failed: ${j.name}`);
    }
  }
  console.log(`sent ${sent}, failed ${failed}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
