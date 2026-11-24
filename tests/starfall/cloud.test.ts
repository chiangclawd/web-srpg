// 雲端同步的合併規則：兩台裝置的進度合起來不能掉星、不能買超過零件，壞掉的雲端資料不能弄壞存檔；
// 刪除或匯入過的存檔要整份取代舊的；三個存檔寫成雲端文件再讀回來要一樣。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanProgress, cleanSlot, emptySlot, isEmptySlot, mergeProgress, mergeSlot, mergeSuspend, progressKey, readDoc, sameSlot, writeDoc } from '../../src/starfall/cloud/merge';
import type { Progress, SlotData } from '../../src/starfall/cloud/merge';
import { partsEarned, partsSpent } from '../../src/starfall/data/upgrades';

const P = (p: Partial<Progress>): Progress => ({ stars: {}, tips: [], upgrades: {}, at: 0, epoch: 0, ...p });
const S = (p: Partial<SlotData>): SlotData => ({ ...emptySlot(), ...p });

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
  const p = cleanProgress({ stars: { m1: 99, m2: -4, m3: 'x', m4: 2.9 }, tips: ['a', 'a', 7, null], upgrades: { kai: { plating: 9, firepower: 'no', mods: ['kai_link', 'not_a_mod'] }, stranger: { plating: 3 } }, at: 'soon', epoch: -3 });
  assert.deepEqual(p.stars, { m1: 3, m4: 2 });
  assert.deepEqual(p.tips, ['a']);
  assert.deepEqual(p.upgrades, { kai: { plating: 3, firepower: 0, mods: ['kai_link'] } });
  assert.equal(p.at, 0);
  assert.equal(p.epoch, 0);
  for (const junk of [null, undefined, 3, 'x', []]) assert.deepEqual(cleanProgress(junk), P({}));
  const d = cleanSlot({ battle: 42, battleAt: -5 });
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

test('刪除或匯入過的存檔整份取代舊的，不合併', () => {
  const old = S({ stars: { m1: 3, m2: 3 }, tips: ['a'], at: 500, upgrades: { kai: { plating: 1, firepower: 0, mods: [] } }, battle: '{"old":1}', battleAt: 900 });
  // 刪除：空的，但 epoch 比較新
  const wiped = S({ at: 600, epoch: 600, battleAt: 600 });
  for (const m of [mergeSlot(old, wiped), mergeSlot(wiped, old)]) {
    assert.deepEqual(m.stars, {});
    assert.deepEqual(m.upgrades, {});
    assert.equal(m.battle, null, '舊進度那場打到一半的戰鬥不該留下來，就算它存得比較晚');
    assert.equal(m.epoch, 600);
  }
  // 刪除之後又玩了一點，另一台還是舊的：新的那份留著
  const replay = S({ stars: { m1: 1 }, at: 700, epoch: 600 });
  assert.deepEqual(mergeSlot(old, replay).stars, { m1: 1 });
  // 兩邊是同一次重來之後的：照平常的規則合併
  const other = S({ stars: { m1: 2, m2: 1 }, at: 650, epoch: 600 });
  assert.deepEqual(mergeSlot(replay, other).stars, { m1: 2, m2: 1 });
  // 比較晚的重來贏
  assert.equal(mergeSlot(S({ epoch: 600, stars: { m1: 3 } }), S({ epoch: 800, stars: { m2: 1 } })).stars.m1, undefined);
});

test('三個存檔寫成雲端文件再讀回來一樣；沒用到的欄位不寫', () => {
  const s1 = S({ stars: { m1: 3 }, tips: ['t'], at: 5, battle: '{"b":1}', battleAt: 6 });
  const s2 = S({ stars: { m2: 2 }, at: 7, epoch: 3, upgrades: { kai: { plating: 1, firepower: 0, mods: [] } } });
  // 只用存檔 1、沒刪過：文件跟只有一個存檔的舊版一模一樣（舊的資料庫規則照樣收）
  const plain = writeDoc({ 1: s1, 2: emptySlot(), 3: emptySlot() });
  assert.deepEqual(Object.keys(plain).sort(), ['at', 'battle', 'battleAt', 'stars', 'tips', 'upgrades', 'v']);
  const doc = writeDoc({ 1: s1, 2: s2, 3: emptySlot() });
  assert.deepEqual(Object.keys(doc.slots ?? {}), ['2']);
  const back = readDoc(JSON.parse(JSON.stringify(doc)));
  assert.ok(sameSlot(back[1], s1) && sameSlot(back[2], s2) && isEmptySlot(back[3]));
  assert.equal(back[2].epoch, 3);
  // 刪掉的存檔 3（空的但有 epoch）也要寫出去，別台裝置才知道它被刪了
  const wiped = writeDoc({ 1: s1, 2: emptySlot(), 3: S({ epoch: 9, at: 9, battleAt: 9 }) });
  assert.deepEqual(Object.keys(wiped.slots ?? {}), ['3']);
  assert.equal(readDoc(wiped)[3].epoch, 9);
  // 舊版寫的文件（沒有 slots、沒有 epoch）讀得進來
  const legacy = readDoc({ v: 1, stars: { m1: 2 }, tips: [], upgrades: {}, at: 1, battle: null, battleAt: 0 });
  assert.deepEqual(legacy[1].stars, { m1: 2 });
  assert.ok(isEmptySlot(legacy[2]) && isEmptySlot(legacy[3]));
  // 亂七八糟的 slots 不會弄壞存檔 1
  assert.deepEqual(readDoc({ stars: { m1: 1 }, slots: 'nope' })[1].stars, { m1: 1 });
});
