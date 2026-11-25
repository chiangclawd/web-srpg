/**
 * 立繪的表情差分：拿現有的立繪當參考圖，請 Gemini 只換表情重畫一張。這支只負責生成（要花錢），
 * 生成的原圖之後用 scripts/art/starfall_faces.py 把臉那一塊貼回原本的立繪上。
 *
 * 用法：node scripts/art/starfall-faces.mjs <原圖資料夾> [誰[:表情] ...] --max=<最多生成幾張>
 *   node scripts/art/starfall-faces.mjs tmp/faces                 # 只列出還缺哪些，不生成
 *   node scripts/art/starfall-faces.mjs tmp/faces --max=18        # 把缺的生出來，最多 18 張
 *   node scripts/art/starfall-faces.mjs tmp/faces kai:smile --max=1 --redo   # 重做一張（舊的改名留著）
 *
 * 沒有加 --max 就不會發出任何請求。已經有的圖不會重做，除非加 --redo。
 * 表情的清單和描述在 scripts/art/prompts/starfall/faces.json；角色的外觀沿用 pt_<誰>.txt。
 * 環境變數：GEMINI_API_KEY（金鑰）、GEMINI_IMAGE_MODEL（預設 gemini-nano-banana-2.1）。花費記在 <原圖資料夾>/ledger.jsonl。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const PROMPTS = path.join(HERE, 'prompts/starfall');

// 參考圖的畫布：3:4，洋紅底。立繪放大到最高 1110、最寬 880，貼齊底邊置中。
// starfall_faces.py 用同一組數字把生成的圖對回原本的立繪，兩邊要一致。
export const CANVAS = { w: 900, h: 1200, maxH: 1110, maxW: 880 };

export function placement(w, h) {
  const s = Math.min(CANVAS.maxH / h, CANVAS.maxW / w);
  const bw = Math.round(w * s);
  const bh = Math.round(h * s);
  return { scale: s, w: bw, h: bh, left: Math.round((CANVAS.w - bw) / 2), top: CANVAS.h - bh };
}

const readPrompt = (f) => fs.readFileSync(path.join(PROMPTS, f), 'utf8').replace(/\r\n/g, '\n');

export function facePrompt(who, face, spec) {
  // 角色原本的描述，拿掉它自己的表情那一句
  const sheet = spec.sheet ?? readPrompt(`pt_${who}.txt`).trim().replace(/\s*Expression:[^\n]*$/, '');
  const keep =
    spec.keep ??
    'the same person (face shape, nose, eye shape and colour, skin tone, every scar and mark), the same hair, the same clothes and gear in the same places, the same pose, head angle, framing and size in the frame, the same line weight, cel shading and colours, and the same flat magenta background';
  return [
    'The attached image is the existing portrait of this exact character. Redraw the same portrait with a different facial expression.',
    '',
    `Keep everything else identical to the attached image: ${keep}.`,
    '',
    `New expression: ${spec.faces[face]}`,
    '',
    sheet,
    // 畫風沿用立繪的那一段，但拿掉「面向右前方、看著鏡頭」那一句：姿勢和視線以參考圖為準，有的表情本來就不看鏡頭
    readPrompt('_portrait.txt').trimEnd().replace(/ Bust shot[^\n]*/, ''),
    '',
  ].join('\n');
}

async function buildRef(who, file) {
  const src = path.join(ROOT, `public/assets/starfall/pt_${who}.webp`);
  const meta = await sharp(src).metadata();
  const p = placement(meta.width, meta.height);
  const body = await sharp(src).resize(p.w, p.h).png().toBuffer();
  await sharp({ create: { width: CANVAS.w, height: CANVAS.h, channels: 3, background: '#ff00ff' } })
    .composite([{ input: body, left: p.left, top: p.top }])
    .png()
    .toFile(file);
}

async function main() {
  const args = process.argv.slice(2);
  const flags = args.filter((a) => a.startsWith('--'));
  const [dir, ...only] = args.filter((a) => !a.startsWith('--'));
  if (!dir) {
    console.error('usage: starfall-faces.mjs <raw-dir> [who[:face] ...] --max=<n> [--redo]');
    process.exit(2);
  }
  const max = Number(flags.find((f) => f.startsWith('--max='))?.slice(6) ?? 0);
  const redo = flags.includes('--redo');
  const spec = JSON.parse(readPrompt('faces.json'));
  fs.mkdirSync(dir, { recursive: true });

  const jobs = [];
  for (const [who, s] of Object.entries(spec)) {
    for (const face of Object.keys(s.faces)) {
      if (only.length && !only.includes(who) && !only.includes(`${who}:${face}`)) continue;
      const out = path.join(dir, `${who}-${face}.png`);
      const have = fs.existsSync(out);
      if (have && !redo) continue;
      jobs.push({ who, face, out, have });
    }
  }
  const model = process.env.GEMINI_IMAGE_MODEL ?? 'gemini-nano-banana-2.1';
  console.log(`${jobs.length} to generate with ${model}: ${jobs.map((j) => `${j.who}:${j.face}`).join(' ') || '(none)'}`);
  if (!max) {
    if (jobs.length) console.log('nothing sent: pass --max=<n> to generate');
    return;
  }

  let sent = 0;
  let failed = 0;
  for (const j of jobs) {
    if (sent >= max) {
      console.log(`stopped at --max=${max}; ${jobs.length - sent} left`);
      break;
    }
    const ref = path.join(dir, `${j.who}-ref.png`);
    if (!fs.existsSync(ref)) await buildRef(j.who, ref);
    const promptFile = path.join(dir, `${j.who}-${j.face}.txt`);
    fs.writeFileSync(promptFile, facePrompt(j.who, j.face, spec[j.who]));
    if (j.have) {
      // 重做：舊的留著，方便比較
      let n = 1;
      while (fs.existsSync(path.join(dir, `${j.who}-${j.face}.old${n}.png`))) n++;
      fs.renameSync(j.out, path.join(dir, `${j.who}-${j.face}.old${n}.png`));
    }
    sent++;
    const r = spawnSync(process.execPath, [path.join(HERE, 'gemini-image.mjs'), j.out, promptFile, ref], {
      stdio: 'inherit',
      env: { ...process.env, GEMINI_IMAGE_MODEL: model, GEMINI_ASPECT: '3:4', GEMINI_SIZE: '1K', ART_LEDGER: path.join(dir, 'ledger.jsonl') },
    });
    if (r.status !== 0) {
      failed++;
      console.log(`failed: ${j.who}:${j.face}`);
    }
  }
  console.log(`sent ${sent}, failed ${failed}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
