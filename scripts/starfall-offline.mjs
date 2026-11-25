// 《星墜殘響》離線遊玩：建置時列出整個遊戲用到的檔案，連同 service worker 的樣板（src/starfall/offline/sw.js）
// 寫成 dist/starfall-sw.js。vite.config.ts 用 starfallOffline()；其餘的函式分開寫是為了能測（tests/starfall/offline.test.ts）。
// 清單的每一項是 [網址, 版本, 位元組數]：版本用來判斷更新時要不要重抓，大小用來算下載進度。
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const sha = (data) => crypto.createHash('sha1').update(data).digest('hex').slice(0, 10);

/** 打包出來的一個檔案有多大 */
const sizeOf = (c) => {
  const body = c.type === 'chunk' ? c.code : c.source;
  return typeof body === 'string' ? Buffer.byteLength(body) : (body?.length ?? 0);
};

/**
 * 從進入點出發，它直接或間接用到的打包檔：一起載入的、之後才動態載入的、CSS 和打包進來的素材。
 * 檔名已經帶內容的雜湊，版本留空字串。
 */
export function chunkFiles(bundle, entryFile) {
  const seen = new Set();
  const walk = (name) => {
    const c = bundle[name];
    if (!c || seen.has(name)) return;
    seen.add(name);
    if (c.type !== 'chunk') return;
    for (const n of [...(c.imports ?? []), ...(c.dynamicImports ?? [])]) walk(n);
    for (const n of [...(c.viteMetadata?.importedCss ?? []), ...(c.viteMetadata?.importedAssets ?? [])]) walk(n);
  };
  walk(entryFile);
  return [...seen]
    .filter((f) => !f.endsWith('.map'))
    .sort()
    .map((f) => [f, '', sizeOf(bundle[f])]);
}

/** 分享卡片的預覽圖只有社群網站會抓，遊戲本身用不到 */
const SKIP = new Set(['assets/starfall/og.jpg']);

/** public 底下這個遊戲的素材。檔名不帶雜湊，內容換了要靠版本（內容的雜湊）才知道 */
export function publicFiles(publicDir, sub = 'assets/starfall') {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else {
        const rel = path.relative(publicDir, p).split(path.sep).join('/');
        if (SKIP.has(rel)) continue;
        const data = fs.readFileSync(p);
        out.push([rel, sha(data), data.length]);
      }
    }
  };
  walk(path.join(publicDir, sub));
  return out.sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

/** 下載的先後：頁面和程式、字型、畫面用的圖、機體圖表、音效，音樂最後。第一次開遊戲時先把眼前要用的抓完 */
const rank = (url) => (/\.(html|js|css)$/.test(url) ? 0 : url.includes('/fonts/') ? 1 : url.includes('/units/') ? 3 : url.includes('/sfx/') ? 4 : url.includes('/music/') ? 5 : 2);

/** 整份清單（照下載的先後排好）和這一版的代號：清單裡任何一項變了，代號就變 */
export function offlineList(page, chunks, assets) {
  const files = [page, ...chunks, ...assets]
    .map((f, i) => ({ f, i }))
    .sort((a, b) => rank(a.f[0]) - rank(b.f[0]) || a.i - b.i)
    .map((x) => x.f);
  return { build: sha(JSON.stringify(files)), files };
}

export const swSource = (template, build, files) => `const BUILD = ${JSON.stringify(build)};\nconst FILES = ${JSON.stringify(files)};\n${template}`;

/** Vite 外掛：正式建置時多產生一個 starfall-sw.js。只打包塔防的 App 版（--mode app）沒有 starfall.html，什麼都不做 */
export function starfallOffline() {
  let cfg;
  return {
    name: 'starfall-offline',
    apply: 'build',
    enforce: 'post',
    configResolved(c) {
      cfg = c;
    },
    generateBundle(_options, bundle) {
      const entry = Object.values(bundle).find((c) => c.type === 'chunk' && c.isEntry && /[\\/]starfall\.html$/.test(c.facadeModuleId ?? ''));
      if (!entry) return;
      // 頁面本身的版本：拿得到內容就用內容（只改了 HTML 的時候也要算新版），拿不到就用進入點的檔名
      const html = bundle['starfall.html'];
      const page = ['starfall.html', sha(html?.type === 'asset' ? String(html.source) : entry.fileName), html ? sizeOf(html) : 0];
      const { build, files } = offlineList(page, chunkFiles(bundle, entry.fileName), publicFiles(cfg.publicDir));
      const template = fs.readFileSync(path.join(cfg.root, 'src/starfall/offline/sw.js'), 'utf8').replace(/\r\n/g, '\n');
      this.emitFile({ type: 'asset', fileName: 'starfall-sw.js', source: swSource(template, build, files) });
    },
  };
}
