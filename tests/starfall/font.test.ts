// 內嵌字型：畫面上會出現的每個字都要在字表裡（字型是照字表做的），字型檔和授權也要在。
// 這個測試失敗 = 加了新的文字、用到字型裡沒有的字。重做字型的兩個指令寫在 scripts/art/fonts/chars.ts 開頭。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CHARS_FILE, collectChars } from '../../scripts/art/fonts/chars';

const FONTS = path.resolve(path.dirname(CHARS_FILE), '../../../public/assets/starfall/fonts');

test('遊戲用到的字都在字表裡', () => {
  const have = new Set(fs.readFileSync(CHARS_FILE, 'utf8'));
  const missing = [...collectChars()].filter((c) => !have.has(c));
  assert.deepEqual(missing, [], `字表裡沒有這些字：${missing.join('')}（執行 npm run starfall:font-chars，再重做字型）`);
});

test('字型檔和授權都在', () => {
  for (const f of ['starfall-sans-400.woff2', 'starfall-sans-700.woff2', 'OFL.txt']) assert.ok(fs.statSync(path.join(FONTS, f)).size > 1000, f);
  // 字表比字型檔新 = 改了字表卻沒重做字型
  const chars = fs.statSync(CHARS_FILE);
  assert.ok(chars.size > 500);
});
