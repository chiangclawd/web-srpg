// 《星墜殘響》的製作名單與授權頁：public/legal/starfall-licenses.html。
//   node scripts/starfall-legal.mjs        重新產生（升級了 phaser、firebase 之類的套件之後要跑一次）
// 內容：製作名單（跟遊戲裡那一頁一樣），加上打包進遊戲的第三方程式和字型的授權全文。
// 授權文字直接從 node_modules 和字型旁邊的 OFL.txt 讀，不手抄。
// PACKAGES 要跟實際打包進去的套件一致：建置時 scripts/starfall-offline.mjs 會對一次，多了沒列的套件就讓建置失敗；
// tests/starfall/legal.test.ts 檢查放進版本庫的那一頁是不是最新的。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const LICENSES_FILE = path.join(ROOT, 'public/legal/starfall-licenses.html');

/**
 * 打包進遊戲的第三方套件，照授權分組。text 是授權全文的來源：node_modules 裡那個套件的檔案，
 * 或 scripts/legal/ 底下的檔案（Firebase 的套件裡沒有附 Apache 2.0 的全文）。
 */
export const PACKAGES = [
  { title: 'Phaser', names: ['phaser'], license: 'MIT', url: 'https://phaser.io', text: 'node_modules/phaser/LICENSE.md' },
  {
    title: 'Firebase JavaScript SDK',
    names: ['firebase', '@firebase/app', '@firebase/auth', '@firebase/component', '@firebase/firestore', '@firebase/logger', '@firebase/util', '@firebase/webchannel-wrapper'],
    license: 'Apache-2.0',
    url: 'https://firebase.google.com',
    notice: 'Copyright Google LLC',
    text: 'scripts/legal/apache-2.0.txt',
  },
  { title: 'idb', names: ['idb'], license: 'ISC', url: 'https://github.com/jakearchibald/idb', text: 'node_modules/idb/LICENSE' },
  { title: 'tslib', names: ['tslib'], license: '0BSD', url: 'https://github.com/microsoft/tslib', text: 'node_modules/tslib/LICENSE.txt' },
];

/** 上面列到的每一個套件名稱 */
export const LICENSED = PACKAGES.flatMap((p) => p.names);

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n').trim();
const version = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules', name, 'package.json'), 'utf8')).version;

const CREDITS = {
  zh: [
    ['企劃・程式・製作', 'chiangclawd'],
    ['立繪・背景・主視覺', '用 Google Gemini 生成'],
    ['機體', '模型用 Meshy 生成，Blender 渲染'],
    ['配樂', '用 Google Lyria 生成'],
    ['音效', '用程式合成'],
    ['字型', '思源黑體（Noto Sans TC），SIL Open Font License 1.1'],
    ['引擎與程式庫', 'Phaser 3（MIT）、Firebase（Apache 2.0）'],
    ['開發工具', 'Claude Code、TypeScript、Vite、Blender'],
  ],
  en: [
    ['Design, code, production', 'chiangclawd'],
    ['Portraits, backgrounds, key art', 'Generated with Google Gemini'],
    ['Units', 'Models generated with Meshy, rendered in Blender'],
    ['Music', 'Generated with Google Lyria'],
    ['Sound effects', 'Synthesised in code'],
    ['Typeface', 'Noto Sans TC, SIL Open Font License 1.1'],
    ['Engine and libraries', 'Phaser 3 (MIT), Firebase (Apache 2.0)'],
    ['Tools', 'Claude Code, TypeScript, Vite, Blender'],
  ],
};

const table = (rows) => `<table>\n${rows.map(([a, b]) => `          <tr><th>${esc(a)}</th><td>${esc(b)}</td></tr>`).join('\n')}\n        </table>`;

/** 整頁的 HTML */
export function renderLicenses() {
  const blocks = [
    {
      title: 'Noto Sans TC（思源黑體）',
      meta: 'SIL Open Font License 1.1 · <a href="https://fonts.google.com/noto/specimen/Noto+Sans+TC" rel="noopener">fonts.google.com/noto</a>',
      text: read('public/assets/starfall/fonts/OFL.txt'),
    },
    ...PACKAGES.map((p) => ({
      title: p.title,
      meta: `${esc(p.license)} · <a href="${p.url}" rel="noopener">${esc(p.url.replace(/^https:\/\//, ''))}</a><br />${p.names.map((n) => `${esc(n)} ${esc(version(n))}`).join(' · ')}`,
      text: (p.notice ? `${p.notice}\n\n` : '') + read(p.text),
    })),
  ];
  const licences = blocks.map((b) => `        <h3>${esc(b.title)}</h3>\n        <p class="meta">${b.meta}</p>\n        <pre>${esc(b.text)}</pre>`).join('\n\n');
  return `<!DOCTYPE html>
<html lang="zh-TW">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>製作名單與授權 Credits and licences｜星墜殘響 Starfall Echo</title>
    <meta name="description" content="星墜殘響 Starfall Echo 的製作名單，以及遊戲用到的字型和程式庫的授權全文。" />
    <meta name="theme-color" content="#070d18" />
    <!-- 這一頁是 scripts/starfall-legal.mjs 產生的，不要直接改 -->
    <style>
      :root {
        --bg: #e9eff6;
        --paper: #f7fafd;
        --ink: #14212f;
        --muted: #50657a;
        --accent: #0b6f95;
        --rule: #c3d2e0;
        --code: #eef3f8;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --bg: #070d18;
          --paper: #0d1826;
          --ink: #e2edf8;
          --muted: #8fb0c8;
          --accent: #5fe3ff;
          --rule: #23384d;
          --code: #08111c;
        }
      }
      html { background: var(--bg); }
      body {
        margin: 0 auto;
        max-width: 760px;
        padding: max(24px, env(safe-area-inset-top)) max(18px, env(safe-area-inset-right)) 48px max(18px, env(safe-area-inset-left));
        font: 16px/1.7 "PingFang TC", "Microsoft JhengHei", "Noto Sans TC", "Trebuchet MS", sans-serif;
        color: var(--ink);
      }
      main { background: var(--paper); border: 1px solid var(--rule); border-radius: 14px; padding: 8px 22px 22px; }
      h1 { font-size: 1.5rem; line-height: 1.3; margin: 18px 0 4px; color: var(--accent); }
      h2 { font-size: 1.1rem; margin: 24px 0 6px; }
      h3 { font-size: 1rem; margin: 22px 0 2px; }
      p, li { margin: 6px 0; }
      table { border-collapse: collapse; width: 100%; margin: 10px 0; }
      th, td { text-align: left; vertical-align: top; padding: 6px 10px 6px 0; border-top: 1px solid var(--rule); }
      th { width: 34%; color: var(--muted); font-weight: normal; }
      pre { background: var(--code); border: 1px solid var(--rule); border-radius: 8px; padding: 12px 14px; font: 12.5px/1.55 Consolas, Menlo, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
      .date, .meta { color: var(--muted); font-size: 0.9rem; margin: 0 0 8px; }
      .lang { border-top: 1px solid var(--rule); margin-top: 28px; padding-top: 4px; }
      nav { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 14px; font-size: 0.95rem; }
      a { color: var(--accent); }
    </style>
  </head>
  <body>
    <nav>
      <a href="../starfall.html">← 回到遊戲 Back to the game</a>
      <a href="#en">English</a>
    </nav>
    <main>
      <h1>製作名單與授權</h1>
      <p class="date">《星墜殘響 Starfall Echo》</p>
      ${table(CREDITS.zh)}
      <p>圖像、模型和配樂是用生成式 AI 工具做的，再經過挑選和整理。遊戲執行的時候不會生成任何內容。</p>
      <p>隱私權說明在<a href="starfall-privacy.html">另一頁</a>。</p>

      <div class="lang" id="en">
        <h1>Credits and licences</h1>
        <p class="date">Starfall Echo</p>
        ${table(CREDITS.en)}
        <p>The images, models and music were made with generative AI tools, then selected and edited. Nothing is generated while the game runs.</p>
        <p>The privacy notice is on <a href="starfall-privacy.html#en">its own page</a>.</p>
      </div>

      <div class="lang" id="licenses">
        <h2>第三方授權 Third-party licences</h2>
        <p>遊戲裡包含下面這些字型和程式庫，各依它們自己的授權使用。The game includes the following typeface and libraries, each under its own licence.</p>

${licences}
      </div>
    </main>
  </body>
</html>
`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fs.mkdirSync(path.dirname(LICENSES_FILE), { recursive: true });
  const html = renderLicenses();
  fs.writeFileSync(LICENSES_FILE, html);
  console.log(`${path.relative(ROOT, LICENSES_FILE)}: ${Buffer.byteLength(html)} bytes, ${LICENSED.length} packages`);
}
