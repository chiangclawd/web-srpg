// 雲端同步的合併規則：兩台裝置的進度合起來不能掉星、不能買超過零件，壞掉的雲端資料不能弄壞存檔。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanDoc, cleanProgress, mergeProgress, mergeSuspend, progressKey } from '../../src/starfall/cloud/merge';
import type { Progress } from '../../src/starfall/cloud/merge';
import { partsEarned, partsSpent } from '../../src/starfall/data/upgrades';

const P = (p: Partial<Progress>): Progress => ({ stars: {}, tips: [], upgrades: {}, at: 0, ...p });

test('星數每關取比較多的，教學提示取聯集', () => {
  const m = mergeProgress(P({ stars: { m1: 3, m2: 1 }, tips: ['a', 'b'] }), P({ stars: { m2: 2, m3: 1 }, tips: ['b', 'c'] }));
  assert.deepEqual(m.stars, { m1: 3, m2: 2, m3: 1 });
  assert.deepEqual([...m.tips].sort(), ['a', 'b', 'c']);
});

test('改造整套用比較晚改動的那一邊（退掉的不會被另一台加回來）', () => {
  const stars = { m1: 3, m2: 3, m3: 3 };
  const old = P({ stars, at: 100, upgrades: { kai: { plating: 2, firepower: 1, mods: [] } } });
  const reset = P({ stars, at: 200, upgrades: {} });
  assert.deepEqual(mergeProgress(old, reset).upgrades, {});
  assert.deepEqual(mergeProgress(reset, old).upgrades, {});
  const newer = P({ stars, at: 300, upgrades: { bruno: { plating: 1, firepower: 0, mods: [] } } });
  assert.deepEqual(mergeProgress(old, newer).upgrades, newer.upgrades);
  assert.equal(mergeProgress(old, newer).at, 300);
});

test('合併的順序不影響結果', () => {
  const a = P({ stars: { m1: 2, m4: 3 }, tips: ['x'], at: 5, upgrades: { kai: { plating: 1, firepower: 0, mods: [] } } });
  const b = P({ stars: { m1: 3, m2: 3 }, tips: ['y'], at: 9, upgrades: { vey: { plating: 0, firepower: 1, mods: [] } } });
  assert.equal(progressKey(mergeProgress(a, b)), progressKey(mergeProgress(b, a)));
  // 自己跟自己合併不會變
  assert.equal(progressKey(mergeProgress(a, a)), progressKey(a));
});

test('合併後花掉的零件不會超過賺到的', () => {
  // 比較晚的那邊被手改成買不起的改造：退回另一邊的；兩邊都買不起就清空
  const cheat = P({ stars: { m1: 1 }, at: 9, upgrades: { kai: { plating: 3, firepower: 3, mods: ['kai_link', 'kai_burst'] }, bruno: { plating: 3, firepower: 3, mods: [] } } });
  const honest = P({ stars: { m1: 1 }, at: 1, upgrades: { kai: { plating: 1, firepower: 0, mods: [] } } });
  const m = mergeProgress(cheat, honest);
  assert.ok(partsSpent(m.upgrades) <= partsEarned(m.stars));
  assert.deepEqual(m.upgrades, honest.upgrades);
  assert.deepEqual(mergeProgress(cheat, P({ at: 0 })).upgrades.kai, undefined);
});

test('來路不明的資料會被整理乾淨', () => {
  const p = cleanProgress({ stars: { m1: 99, m2: -4, m3: 'x', m4: 2.9 }, tips: ['a', 'a', 7, null], upgrades: { kai: { plating: 9, firepower: 'no', mods: ['kai_link', 'not_a_mod'] }, stranger: { plating: 3 } }, at: 'soon' });
  assert.deepEqual(p.stars, { m1: 3, m4: 2 });
  assert.deepEqual(p.tips, ['a']);
  assert.deepEqual(p.upgrades, { kai: { plating: 3, firepower: 0, mods: ['kai_link'] } });
  assert.equal(p.at, 0);
  for (const junk of [null, undefined, 3, 'x', []]) assert.deepEqual(cleanProgress(junk), P({}));
  const d = cleanDoc({ battle: 42, battleAt: -5 });
  assert.equal(d.battle, null);
  assert.equal(d.battleAt, 0);
});

test('打到一半的戰鬥：比較晚存或比較晚清掉的算數', () => {
  const saved = { json: '{"snap":1}', at: 10 };
  const cleared = { json: null, at: 20 };
  assert.equal(mergeSuspend(saved, cleared), cleared);
  assert.equal(mergeSuspend(cleared, saved), cleared);
  // 另一台沒有這場戰鬥的紀錄（時間是 0）：留著
  assert.equal(mergeSuspend(saved, { json: null, at: 0 }), saved);
});
