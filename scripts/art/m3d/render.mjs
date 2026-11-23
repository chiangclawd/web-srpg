// 3D 角色 → 遊戲用逐格圖表（Meshy 試作）
//
// 流程：
//   1. scripts/art/meshy.mjs image / remesh / rig / anim 產生模型與動作（GLB），fetch 下載到 <models-dir>
//   2. npm i --no-save three@0.169.0（只有渲染時需要，不進遊戲）
//   3. node scripts/art/m3d/render.mjs [--gpu] scripts/art/m3d/raider.json <models-dir> public/assets/m3d/raider.webp
//      （同時寫出 raider.json：裁掉透明邊的格子位置，Phaser atlas 格式）
//   4. 把印出來的 unitPx / cycle 填進 src/td/view/Sheets.ts（版本指紋 sheetRev.ts 會自動更新）
//
// 用 headless Chromium 跑 three.js：卡通材質 + 描邊，從遊戲的斜俯視角渲染
// 側面 / 正面 / 背面 × 待機 / 走路 / 出招 / 受擊 / 倒地，再交給 pack.py 排成一張圖。
//
// 預設用軟體渲染（SwiftShader），沒有顯示卡的環境也能跑。
// --gpu 改用這台電腦的顯示卡（Windows 上是 ANGLE D3D11）；瀏覽器實際沒用到顯示卡時會直接報錯，不會悄悄退回軟體渲染。
// 兩種渲染肉眼看起來一樣，但像素不完全相同（裁邊也可能差一像素），同一批圖表不要混著用。
//
// 環境變數：
//   PLAYWRIGHT  Playwright 模組的位置（預設 require('playwright')，沒裝的話 npm i --no-save playwright）
//   PW_CHANNEL  指定瀏覽器（chrome / msedge）。沒設的話用 Playwright 自帶的 Chromium，沒裝才改用系統的 Chrome
//   PYTHON      跑 pack.py 的 Python（需要 Pillow）。預設 Windows 用 py，其他用 python3
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const gpu = argv.includes('--gpu');
const [cfgPath, modelsDir, outFile] = argv.filter((a) => a !== '--gpu');
if (!cfgPath || !modelsDir || !outFile) {
  console.error('usage: render.mjs [--gpu] <config.json> <models-dir> <out.webp>');
  process.exit(2);
}
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? 'playwright');
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
// fileURLToPath：Windows 的磁碟代號、路徑裡的空白（%20）用 URL 的 pathname 會組出錯的路徑
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const models = path.resolve(modelsDir);
const strips = fs.mkdtempSync(path.join(os.tmpdir(), 'm3d-'));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.glb': 'model/gltf-binary' };

// /models/… 指向模型資料夾，其他路徑指向 repo（render.html 與 node_modules/three）
const srv = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const [root, rel] = url.startsWith('/models/') ? [models, url.slice(8)] : [repo, url];
  const p = path.join(root, rel);
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { 'content-type': types[path.extname(p)] ?? 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((ok) => srv.listen(0, ok));
const port = srv.address().port;

const glArgs = gpu
  ? ['--ignore-gpu-blocklist', '--enable-gpu', ...(process.platform === 'win32' ? ['--use-gl=angle', '--use-angle=d3d11'] : [])]
  : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
async function launch() {
  if (process.env.PW_CHANNEL) return chromium.launch({ channel: process.env.PW_CHANNEL, args: glArgs });
  try {
    return await chromium.launch({ args: glArgs });
  } catch (e) {
    // 沒跑過 npx playwright install：改用系統裝的 Chrome
    if (!/Executable doesn't exist/.test(e.message)) throw e;
    return chromium.launch({ channel: 'chrome', args: glArgs });
  }
}
const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('pageerror', e.message));
await page.goto(`http://localhost:${port}/scripts/art/m3d/render.html`);
await page.waitForFunction(() => window.ready, null, { timeout: 30000 });
// 印出實際的渲染器，確認用的是哪一種
const gl = await page.evaluate(() => {
  const g = document.createElement('canvas').getContext('webgl2');
  const ext = g?.getExtension('WEBGL_debug_renderer_info');
  return g ? g.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : g.RENDERER) : 'none';
});
console.log('gl', gl);
if (gpu && /swiftshader|llvmpipe|softpipe|basic render|^none$/i.test(gl)) {
  await browser.close();
  srv.close();
  fs.rmSync(strips, { recursive: true, force: true });
  console.error('--gpu：瀏覽器沒有用到顯示卡（實際的渲染器見上一行）。可以試 PW_CHANNEL=chrome 改用系統的 Chrome。');
  process.exit(1);
}
const r = await page.evaluate((c) => window.renderSheets(c), cfg);
await browser.close();
srv.close();

for (const [k, url] of Object.entries(r.sheets)) fs.writeFileSync(path.join(strips, `${k}.png`), Buffer.from(url.split(',')[1], 'base64'));
fs.writeFileSync(path.join(strips, 'frame.json'), JSON.stringify({ ...r.frame, ...r.stats }));
console.log('clips', JSON.stringify(r.clips));
const python = process.env.PYTHON ?? (process.platform === 'win32' ? 'py' : 'python3');
const out = execFileSync(python, [path.join(repo, 'scripts/art/m3d/pack.py'), strips, outFile, JSON.stringify(cfg.dirs), JSON.stringify(cfg.anims.map((a) => a.name)), ...(cfg.sharpen || cfg.color ? [JSON.stringify(cfg.sharpen ?? null)] : []), ...(cfg.color ? [JSON.stringify(cfg.color)] : [])], { encoding: 'utf8' });
console.log(out.trim());
fs.rmSync(strips, { recursive: true, force: true });
// 更新下載網址的版本指紋（src/td/view/sheetRev.ts）
console.log(execFileSync(process.execPath, [path.join(repo, 'scripts/art/m3d/rev.mjs')], { encoding: 'utf8' }).trim());
