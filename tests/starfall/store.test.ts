// 商店頁文案（STARFALL_STORE_LISTING.md）：每個欄位都在商店的字數上限以內，寫的數字跟遊戲對得上，
// 連到的網址是這個專案自己的頁面。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MISSIONS } from '../../src/starfall/data/missions';
import { CODEX } from '../../src/starfall/data/codex';
import { FEATS } from '../../src/starfall/data/achievements';
import { FRAMES } from '../../src/starfall/data/upgrades';
import { UNITS } from '../../src/starfall/data/units';

const md = fs.readFileSync('STARFALL_STORE_LISTING.md', 'utf8').replace(/\r\n/g, '\n');
const section = (title: string): string => {
  const at = md.indexOf(`\n## ${title}\n`);
  assert.ok(at >= 0, `沒有「${title}」這一節`);
  const end = md.indexOf('\n## ', at + 4);
  return md.slice(at, end < 0 ? undefined : end);
};
/** 單行的欄位 */
const field = (text: string, label: string): string => {
  const m = new RegExp(`\\*\\*${label}\\*\\*[：:] ?(.+)`).exec(text);
  assert.ok(m, `沒有「${label}」這一欄`);
  return m[1].trim();
};
/** 完整說明：從那個標題到下一個粗體欄位 */
const body = (text: string, label: string, next: string): string => {
  const a = text.indexOf(`**${label}**`);
  const b = text.indexOf(`**${next}**`);
  assert.ok(a >= 0 && b > a);
  return text.slice(text.indexOf('\n', a), b).trim();
};

const LANGS = [
  { title: '繁體中文', name: '名稱', sub: '副標題', short: '簡短說明', promo: '宣傳文字', full: '完整說明', keys: '關鍵字' },
  { title: 'English', name: 'Name', sub: 'Subtitle', short: 'Short description', promo: 'Promotional text', full: 'Full description', keys: 'Keywords' },
];

test('商店文案：每個欄位都在字數上限以內', () => {
  for (const l of LANGS) {
    const s = section(l.title);
    const len = (label: string): number => [...field(s, label)].length;
    assert.ok(len(l.name) <= 30, `${l.title} 名稱 ${len(l.name)} 字`);
    assert.ok(len(l.sub) <= 30, `${l.title} 副標題 ${len(l.sub)} 字`);
    assert.ok(len(l.short) <= 80, `${l.title} 簡短說明 ${len(l.short)} 字`);
    assert.ok(len(l.promo) <= 170, `${l.title} 宣傳文字 ${len(l.promo)} 字`);
    assert.ok(len(l.keys) <= 100, `${l.title} 關鍵字 ${len(l.keys)} 字`);
    const full = body(s, l.full, l.keys);
    assert.ok([...full].length > 300 && [...full].length <= 4000, `${l.title} 完整說明 ${[...full].length} 字`);
    // 關鍵字用半形逗號分隔，不留空白，也不重複
    const keys = field(s, l.keys).split(',');
    assert.ok(keys.length >= 6 && keys.every((k) => k === k.trim() && k.length > 0));
    assert.equal(new Set(keys).size, keys.length);
  }
});

test('商店文案：寫的數字跟遊戲對得上', () => {
  // 敵人與設施：我方六台機體以外的每一種（包含要保護的冬眠艙和發電機）
  const foes = Object.keys(UNITS).length - FRAMES.length;
  assert.equal(CODEX.length, Object.keys(UNITS).length, '圖鑑每一種各一則');
  const zh = section('繁體中文');
  const en = section('English');
  for (const [text, parts] of [
    [zh, [`${MISSIONS.length} 個任務`, `${FRAMES.length} 台機體`, `圖鑑 ${CODEX.length} 則`, `成就 ${FEATS.length} 個`, `${foes} 種敵人與設施`]],
    [en, [`${MISSIONS.length} missions`, `${FRAMES.length} frames`, `${CODEX.length} entries`, `${FEATS.length} achievements`, `${foes} kinds of enemies`]],
  ] as const) {
    for (const p of parts) assert.ok(text.includes(p), `文案裡找不到「${p}」`);
  }
});

test('商店文案：網址是這個專案的頁面，檔案都在', () => {
  const other = section('其他欄位');
  assert.ok(other.includes('https://chiangclawd.github.io/web-srpg/legal/starfall-privacy.html'));
  assert.ok(fs.existsSync('public/legal/starfall-privacy.html'));
  assert.ok(other.includes('https://chiangclawd.github.io/web-srpg/echo/'));
  assert.ok(fs.existsSync('public/echo/index.html'));
  for (const script of ['scripts/starfall-shots.cjs', 'scripts/starfall-trailer.cjs']) {
    assert.ok(md.includes(script) && fs.existsSync(script), `${script} 不在`);
  }
});
