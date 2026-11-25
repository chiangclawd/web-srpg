// 製作名單、授權頁、隱私權說明：
// - 打包進遊戲的第三方套件都要列在授權頁上，而且放進版本庫的那一頁是最新的；
// - 遊戲裡的製作名單和那一頁寫的一樣；
// - 隱私權說明提到遊戲實際用到的每一項服務，寫的刪除路徑跟遊戲裡的按鈕對得上；
// - 兩份說明頁放在離線快取管的範圍外面（理由見 src/starfall/legal.ts）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { LICENSED, LICENSES_FILE, PACKAGES, renderLicenses } from '../../scripts/starfall-legal.mjs';
import { bundledPackages, publicFiles } from '../../scripts/starfall-offline.mjs';
import { LEGAL, MAKER } from '../../src/starfall/legal';
import { FEEDBACK } from '../../src/starfall/feedback-config';
import { T, setLang } from '../../src/starfall/i18n';
import type { StrKey } from '../../src/starfall/i18n';

const lf = (s: string): string => s.replace(/\r\n/g, '\n');
const page = (rel: string): string => lf(fs.readFileSync(path.join('public', rel), 'utf8'));
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** 兩種語言的字串各取一次 */
const both = (key: StrKey): string[] =>
  (['zh', 'en'] as const).map((l) => {
    setLang(l);
    return T(key);
  });

function sources(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) sources(p, out);
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

test('授權頁：放進版本庫的那一頁是最新的（升級套件後要重跑 node scripts/starfall-legal.mjs）', () => {
  assert.equal(lf(fs.readFileSync(LICENSES_FILE, 'utf8')), lf(renderLicenses()));
});

test('授權頁：遊戲的程式直接引用的套件都列了，每個套件的授權全文都在', () => {
  const used = new Set<string>();
  for (const f of sources('src/starfall')) {
    const sf = ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.ES2022, true);
    const visit = (n: ts.Node): void => {
      const spec = (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier) ? n.moduleSpecifier.text : ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteral(n.arguments[0]) ? n.arguments[0].text : null;
      if (spec && !spec.startsWith('.')) used.add(spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]);
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  assert.deepEqual([...used].sort(), ['firebase', 'phaser']);
  for (const p of used) assert.ok(LICENSED.includes(p), `${p} 沒有列在授權頁`);
  const html = page(LEGAL.licenses);
  for (const p of PACKAGES) for (const n of p.names) assert.ok(html.includes(`${n} `), `授權頁上沒有 ${n}`);
  for (const text of ['SIL OPEN FONT LICENSE', 'Permission is hereby granted, free of charge', 'Apache License', 'TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION', 'ISC License', 'Copyright (c) Microsoft Corporation', 'Copyright Google LLC']) {
    assert.ok(html.includes(text), `授權頁上沒有「${text}」`);
  }
});

test('建置時的檢查：從進入點走得到的打包檔裡有哪些套件', () => {
  const chunk = (modules: string[], imports: string[] = [], dynamicImports: string[] = []) => ({ type: 'chunk', modules: Object.fromEntries(modules.map((m) => [m, {}])), imports, dynamicImports });
  const bundle = {
    'assets/starfall-a.js': chunk(['D:/proj/src/starfall/main.ts', 'D:\\proj\\node_modules\\phaser\\dist\\phaser.js', '\0vite/preload-helper.js'], [], ['assets/firebase-b.js']),
    'assets/firebase-b.js': chunk(['/proj/node_modules/@firebase/auth/dist/esm2017/index.js', '/proj/node_modules/firebase/node_modules/idb/build/index.js'], ['assets/shared-c.js']),
    'assets/shared-c.js': chunk(['/proj/node_modules/tslib/tslib.es6.mjs']),
    'assets/td-d.js': chunk(['/proj/node_modules/@capacitor/core/dist/index.js']),
    'assets/starfall-a.css': { type: 'asset' },
  };
  assert.deepEqual(bundledPackages(bundle, 'assets/starfall-a.js'), ['@firebase/auth', 'idb', 'phaser', 'tslib']);
});

test('製作名單：遊戲裡的每一列，授權頁上都寫得一樣', () => {
  const html = page(LEGAL.licenses);
  const keys: StrKey[] = ['creditsMade', 'creditsArt', 'creditsArtBy', 'creditsUnits', 'creditsUnitsBy', 'creditsMusic', 'creditsMusicBy', 'creditsSfx', 'creditsSfxBy', 'creditsFont', 'creditsFontBy', 'creditsEngine', 'creditsEngineBy', 'creditsTools', 'creditsToolsBy', 'creditsNote'];
  for (const k of keys) for (const s of both(k)) assert.ok(html.includes(esc(s)), `授權頁上沒有「${s}」（${k}）`);
  assert.ok(html.includes(`<td>${MAKER}</td>`));
});

test('隱私權說明：中英文都有，提到用到的每一項服務和刪除的路徑', () => {
  const html = page(LEGAL.privacy);
  const [zh, en] = html.split('id="en"');
  assert.ok(zh && en, '要有英文的那一段（id="en"）');
  for (const part of [zh, en]) {
    for (const word of ['Firebase Authentication', 'Cloud Firestore', 'GitHub Pages', 'Google', FEEDBACK.form, 'https://github.com/chiangclawd/web-srpg/issues']) assert.ok(part.includes(word), `少了 ${word}`);
  }
  // 說明裡寫的路徑要跟遊戲裡按鈕上的字一樣：設定 → 隱私權 → 刪除雲端資料
  setLang('zh');
  assert.ok(zh.includes(`「${T('settings')} → ${T('privacy')} → ${T('cloudErase')}」`));
  assert.ok(zh.includes(`「${T('report')}」`));
  setLang('en');
  assert.ok(en.includes(`${T('settings')} → ${T('privacy')} → ${T('cloudErase')}`));
  assert.ok(en.includes(`“${T('report')}”`));
  assert.match(zh, /最後更新：\d{4} 年 \d{1,2} 月 \d{1,2} 日/);
  // 遊戲沒有的東西不能寫成有，有的不能漏：沒有分析和廣告的程式
  const code = sources('src/starfall').map((f) => fs.readFileSync(f, 'utf8')).join('\n') + fs.readFileSync('starfall.html', 'utf8');
  assert.ok(!/firebase\/analytics|googletagmanager|gtag\(|google-analytics|adsbygoogle/.test(code), '程式裡出現了分析或廣告：隱私權說明要跟著改');
});

test('兩份說明頁都在，而且在離線快取管的範圍外面', () => {
  const scope = (JSON.parse(fs.readFileSync('public/starfall-manifest.json', 'utf8')) as { scope: string }).scope.replace(/^\.\//, '');
  assert.equal(scope, 'starfall');
  for (const rel of Object.values(LEGAL)) {
    assert.ok(fs.statSync(path.join('public', rel)).size > 2000, rel);
    assert.ok(!rel.startsWith(scope), `${rel} 會被離線快取接管`);
    assert.ok(page(rel).includes('href="../starfall.html"'), `${rel} 要有回到遊戲的連結`);
  }
  assert.ok(!publicFiles('public').some((f: [string, string, number]) => f[0].startsWith('legal/')));
});
