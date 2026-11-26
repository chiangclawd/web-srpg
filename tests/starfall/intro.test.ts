// 介紹頁（public/echo/）：
// - 放在離線快取管的範圍外面，也不在離線下載的清單裡；塔防的 App 不帶它；
// - 連到的檔案都在，截圖的資料夾裡沒有多的也沒有少的；
// - 回報表單的網址跟遊戲裡用的是同一個；
// - 頁面上寫的數字跟遊戲對得上（任務、圖鑑、成就的數量改了，這裡會提醒要改頁面）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { publicFiles } from '../../scripts/starfall-offline.mjs';
import { FEEDBACK } from '../../src/starfall/feedback-config';
import { MAKER } from '../../src/starfall/legal';
import { MISSIONS } from '../../src/starfall/data/missions';
import { CODEX } from '../../src/starfall/data/codex';
import { FEATS } from '../../src/starfall/data/achievements';
import { FRAMES } from '../../src/starfall/data/upgrades';

const DIR = 'public/echo';
const html = fs.readFileSync(`${DIR}/index.html`, 'utf8');
const attrs = (name: string): string[] => [...html.matchAll(new RegExp(`${name}="([^"]+)"`, 'g'))].map((m) => m[1]);

test('介紹頁：在離線快取的範圍外面，不佔離線下載量', () => {
  // 離線快取管的是 starfall 開頭的網址（offline.ts 的 scope）
  assert.ok(!path.basename(DIR).startsWith('starfall'));
  const listed = (publicFiles('public') as [string, string, number][]).map((f) => f[0]);
  assert.ok(listed.length > 100);
  assert.deepEqual(listed.filter((f) => f.startsWith('echo/')), []);
  assert.match(fs.readFileSync('scripts/app-dist.mjs', 'utf8'), /'echo'\]/, '塔防的 App 要把介紹頁拿掉');
});

test('介紹頁：連到的檔案都在', () => {
  const local = [...attrs('href'), ...attrs('src')].filter((u) => !/^(https?:|#)/.test(u));
  assert.ok(local.length >= 12);
  for (const u of local) {
    // 遊戲本身的頁面在專案根目錄（Vite 的入口），其餘的在 public 底下
    const file = u === '../starfall.html' ? 'starfall.html' : path.join(DIR, u);
    assert.ok(fs.existsSync(file), `${u} 連不到（${file}）`);
  }
  assert.match(html, /url\('\.\.\/assets\/starfall\/title\.webp'\)/);
  assert.ok(fs.existsSync('public/assets/starfall/title.webp'));
  // 分享卡片的圖要寫完整網址
  assert.ok(attrs('content').includes('https://chiangclawd.github.io/web-srpg/assets/starfall/og.jpg'));
  assert.ok(fs.existsSync('public/assets/starfall/og.jpg'));
});

test('介紹頁：截圖的資料夾跟頁面用到的一致', () => {
  const used = attrs('src')
    .filter((u) => u.startsWith('shots/'))
    .map((u) => u.slice(6))
    .sort();
  assert.deepEqual(fs.readdirSync(`${DIR}/shots`).sort(), used);
  // 截圖腳本拍的就是這幾張
  const script = fs.readFileSync('scripts/starfall-shots.cjs', 'utf8');
  const shot = [...script.matchAll(/\{ name: '(\w+)', store: \d+/g)].map((m) => `${m[1]}.webp`).sort();
  assert.deepEqual(shot, used);
  for (const f of used) assert.ok(fs.statSync(`${DIR}/shots/${f}`).size < 250 * 1024, `${f} 超過 250 KB`);
});

test('介紹頁：回報表單和製作者跟遊戲裡的一樣', () => {
  const forms = attrs('href').filter((u) => u.includes('docs.google.com/forms'));
  assert.ok(forms.length >= 1);
  for (const u of forms) assert.equal(u, FEEDBACK.form);
  assert.ok(html.includes(`© 2026 ${MAKER}`));
  // 頁面上說的按鈕，遊戲裡真的叫這個名字
  const i18n = fs.readFileSync('src/starfall/i18n.ts', 'utf8');
  for (const label of ['回報問題', '打開回報表單', '安裝', '設定']) {
    assert.ok(html.includes(`「${label}」`), `頁面沒提到「${label}」`);
    assert.ok(i18n.includes(`zh: '${label}'`), `遊戲裡沒有「${label}」這個按鈕`);
  }
});

test('介紹頁：寫的數字跟遊戲對得上', () => {
  assert.ok(html.includes(`${MISSIONS.length} 個任務`));
  assert.ok(html.includes(`${FRAMES.length} 台機體`));
  assert.ok(html.includes(`圖鑑 ${CODEX.length} 則`));
  assert.ok(html.includes(`成就 ${FEATS.length} 個`));
});
