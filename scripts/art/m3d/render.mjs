// 3D 角色 → 遊戲用逐格圖表（Meshy 試作）
//
// 流程：
//   1. scripts/art/meshy.mjs image / remesh / rig / anim 產生模型與動作（GLB），fetch 下載到 <models-dir>
//   2. npm i --no-save three@0.169.0（只有渲染時需要，不進遊戲）
//   3. node scripts/art/m3d/render.mjs scripts/art/m3d/raider.json <models-dir> public/assets/m3d/raider.webp
//      （同時寫出 raider.json：裁掉透明邊的格子位置，Phaser atlas 格式）
//   4. 把印出來的 unitPx / cycle 填進 src/td/view/Sheets.ts
//
// 用 headless Chromium 跑 three.js：卡通材質 + 描邊，從遊戲的斜俯視角渲染
// 側面 / 正面 / 背面 × 待機 / 走路 / 出招 / 受擊 / 倒地，再交給 pack.py 排成一張圖。
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const [cfgPath, modelsDir, outFile] = process.argv.slice(2);
if (!cfgPath || !modelsDir || !outFile) {
  console.error('usage: render.mjs <config.json> <models-dir> <out.webp>');
  process.exit(2);
}
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? 'playwright');
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
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

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('pageerror', e.message));
await page.goto(`http://localhost:${port}/scripts/art/m3d/render.html`);
await page.waitForFunction(() => window.ready, null, { timeout: 30000 });
const r = await page.evaluate((c) => window.renderSheets(c), cfg);
await browser.close();
srv.close();

for (const [k, url] of Object.entries(r.sheets)) fs.writeFileSync(path.join(strips, `${k}.png`), Buffer.from(url.split(',')[1], 'base64'));
fs.writeFileSync(path.join(strips, 'frame.json'), JSON.stringify({ ...r.frame, ...r.stats }));
console.log('clips', JSON.stringify(r.clips));
const out = execFileSync('python3', [path.join(repo, 'scripts/art/m3d/pack.py'), strips, outFile, JSON.stringify(cfg.dirs), JSON.stringify(cfg.anims.map((a) => a.name))], { encoding: 'utf8' });
console.log(out.trim());
fs.rmSync(strips, { recursive: true, force: true });
