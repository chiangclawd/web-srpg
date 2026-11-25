/**
 * 各章的戰鬥配樂：照 TRACKS 的清單，用 scripts/art/prompts/starfall/music_<名字>.txt 請 Lyria 各生成一首。
 *
 * 用法：
 *   node scripts/art/starfall-music.mjs <原檔資料夾>                     # 只列出還缺哪些，不生成
 *   node scripts/art/starfall-music.mjs <原檔資料夾> --max=4             # 把缺的生出來，最多 4 首（要花錢）
 *   node scripts/art/starfall-music.mjs <原檔資料夾> ch3 --max=1 --redo  # 重做一首（舊的改名留著）
 *   node scripts/art/starfall-music.mjs <原檔資料夾> --ship              # 原檔整理成遊戲用的 public/assets/starfall/music/<名字>.mp3（不花錢，要有 ffmpeg）
 *
 * 沒有加 --max 就不會發出任何請求。已經有的不會重做，除非加 --redo。
 * 環境變數：GEMINI_API_KEY（金鑰）、GEMINI_MUSIC_MODEL（預設 lyria-3.5）。花費記在 <原檔資料夾>/ledger.jsonl。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

/** 這支管的曲子（title / battle / boss / ending 是更早做的，原檔不在這裡） */
export const TRACKS = ['ch2', 'ch3', 'ch4', 'rollcall'];

function main() {
  const args = process.argv.slice(2);
  const flags = args.filter((a) => a.startsWith('--'));
  const [dir, ...only] = args.filter((a) => !a.startsWith('--'));
  if (!dir) {
    console.error('usage: starfall-music.mjs <raw-dir> [name ...] [--max=<n> [--redo] | --ship]');
    process.exit(2);
  }
  const unknown = only.filter((n) => !TRACKS.includes(n));
  if (unknown.length) {
    console.error(`not a track: ${unknown.join(' ')}`);
    process.exit(2);
  }
  const names = TRACKS.filter((n) => !only.length || only.includes(n));
  fs.mkdirSync(dir, { recursive: true });

  if (flags.includes('--ship')) {
    const py = process.platform === 'win32' ? ['py', '-3'] : ['python3'];
    for (const name of names) {
      const src = path.join(dir, `${name}.mp3`);
      if (!fs.existsSync(src)) {
        console.log(`${name}: no file yet`);
        continue;
      }
      const out = path.join(ROOT, `public/assets/starfall/music/${name}.mp3`);
      const r = spawnSync(py[0], [...py.slice(1), path.join(HERE, 'prep_music.py'), src, out], { stdio: 'inherit' });
      if (r.status !== 0) process.exit(1);
    }
    return;
  }

  const max = Number(flags.find((f) => f.startsWith('--max='))?.slice(6) ?? 0);
  const redo = flags.includes('--redo');
  const todo = names.map((name) => ({ name, out: path.join(dir, `${name}.mp3`) })).map((j) => ({ ...j, have: fs.existsSync(j.out) })).filter((j) => !j.have || redo);
  const model = process.env.GEMINI_MUSIC_MODEL ?? 'lyria-3.5';
  console.log(`${todo.length} to generate with ${model}: ${todo.map((j) => j.name).join(' ') || '(none)'}`);
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
      let n = 1;
      while (fs.existsSync(path.join(dir, `${j.name}.old${n}.mp3`))) n++;
      fs.renameSync(j.out, path.join(dir, `${j.name}.old${n}.mp3`));
    }
    sent++;
    const r = spawnSync(process.execPath, [path.join(HERE, 'gemini-music.mjs'), j.out, path.join(HERE, `prompts/starfall/music_${j.name}.txt`)], {
      stdio: 'inherit',
      env: { ...process.env, GEMINI_MUSIC_MODEL: model, ART_LEDGER: path.join(dir, 'ledger.jsonl') },
    });
    if (r.status !== 0) {
      failed++;
      console.log(`failed: ${j.name}`);
    }
  }
  console.log(`sent ${sent}, failed ${failed}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
