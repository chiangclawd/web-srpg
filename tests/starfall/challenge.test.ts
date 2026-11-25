// 挑戰模式：敵方的倍率、接著打、打不打得過，和徽章的紀錄。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Battle, HARD_DMG, HARD_HP } from '../../src/starfall/sim/Battle';
import { BOT_STYLES, autoPlay } from '../../src/starfall/sim/ai';
import { cleanProgress, mergeProgress } from '../../src/starfall/cloud/merge';
import { FEATS } from '../../src/starfall/data/achievements';
import { CODEX } from '../../src/starfall/data/codex';
import { MISSIONS, missionById } from '../../src/starfall/data/missions';
import { UNITS } from '../../src/starfall/data/units';
import { FRAMES, TRACK_MAX, loadoutDefs, modsOf, partsEarned, partsSpent } from '../../src/starfall/data/upgrades';
import { challengeDone, challengeOpen, challengeReady, earnedFeats, featProgress, grantFeats, markChallenge, markSeen, stateFeats } from '../../src/starfall/records';
import type { Records } from '../../src/starfall/records';
import type { MissionDef, SpawnDef, Unit, UnitDef } from '../../src/starfall/sim/types';

const R = (p: Partial<Records> = {}): Records => ({ stars: {}, tips: [], upgrades: {}, ...p });
const MAIN = MISSIONS.filter((m) => (m.chapter ?? 1) <= 3);
const EPILOGUE = MISSIONS.filter((m) => (m.chapter ?? 1) > 3);
const stars = (list: readonly MissionDef[]): Record<string, number> => Object.fromEntries(list.map((m) => [m.id, 1]));

/** 六台機體的改造：兩條強化線都升到 lv 級，mods = 專屬改造也全部裝上 */
const loadout = (lv: number, mods = false): Record<string, UnitDef> =>
  loadoutDefs(UNITS, Object.fromEntries(FRAMES.map((f) => [f, { plating: lv, firepower: lv, mods: mods ? modsOf(f).map((m) => m.id) : [] }])));

/** 有哪幾種機器人打法打得過 */
const wins = (m: MissionDef, defs: Record<string, UnitDef>, hard: boolean): number => BOT_STYLES.filter((st) => autoPlay(new Battle(m, defs, false, hard), 40, undefined, st).result === 'win').length;

function mk(units: SpawnDef[], easy: boolean, hard: boolean): Battle {
  const rows = ['.......', '.......', '.......', '.......', '.......'];
  const m: MissionDef = {
    id: 'test',
    name: { zh: '測試', en: 'Test' },
    brief: { zh: '', en: '' },
    tiles: rows,
    heights: rows.map((r) => '0'.repeat(r.length)),
    units,
    win: { type: 'rout' },
    objective: { zh: '', en: '' },
    par: 5,
  };
  const b = new Battle(m, UNITS, easy, hard);
  b.start();
  return b;
}
const u = (b: Battle, id: string): Unit => b.units.find((v) => v.def.id === id)!;

test('挑戰模式：敵方耐久 ×1.3、傷害 ×1.2，我方不變；輕鬆難度在這裡不算數', () => {
  assert.ok(HARD_HP > 1 && HARD_DMG > 1);
  const units: SpawnDef[] = [
    { unit: 'kai', x: 1, y: 2, side: 'player' },
    { unit: 'sentry', x: 3, y: 2, side: 'enemy', dir: 2, ai: 'hold' },
  ];
  const normal = mk(units, false, false);
  // 兩個都開：算挑戰模式
  const hard = mk(units, true, true);
  assert.equal(hard.hard, true);
  assert.equal(hard.easy, false);
  assert.equal(u(hard, 'sentry').maxHp, Math.round(u(normal, 'sentry').maxHp * HARD_HP));
  assert.equal(u(hard, 'sentry').hp, u(hard, 'sentry').maxHp);
  assert.equal(u(hard, 'kai').maxHp, u(normal, 'kai').maxHp, '我方的耐久不變');
  assert.equal(hard.forecast(u(hard, 'kai'), u(hard, 'sentry')).dmg, normal.forecast(u(normal, 'kai'), u(normal, 'sentry')).dmg, '我方的傷害不變');
  // 哨兵的武器 22：一般模式打凱 22 - 2，挑戰模式 22 × 1.2 再減
  const base = normal.forecast(u(normal, 'sentry'), u(normal, 'kai')).dmg;
  const more = hard.forecast(u(hard, 'sentry'), u(hard, 'kai')).dmg;
  assert.equal(base, 22 - 2);
  assert.equal(more, Math.round(22 * HARD_DMG) - 2);
});

test('挑戰模式：中途出來的增援也是強化過的', () => {
  let reinforced = 0;
  for (const m of MISSIONS) {
    const b = new Battle(m, loadout(TRACK_MAX, true), false, true);
    autoPlay(b);
    if (b.units.length > m.units.length) reinforced++;
    for (const v of b.units) {
      const foe = v.side === 'enemy';
      assert.equal(v.maxHp, foe ? Math.round(v.def.hp * HARD_HP) : v.def.hp, `${m.id} ${v.def.id}`);
      assert.equal(v.power, foe ? HARD_DMG : 1, `${m.id} ${v.def.id}`);
    }
  }
  assert.ok(reinforced >= 3, '至少要有幾關真的出了增援');
});

test('挑戰模式：存下來接著打還是挑戰模式；沒有這一欄的舊存檔是一般模式', () => {
  const m = missionById('m5');
  const b = new Battle(m, UNITS, false, true);
  b.start();
  const snap = JSON.parse(JSON.stringify(b.snapshot())) as Record<string, unknown>;
  assert.equal(snap.hard, true);
  const back = Battle.restore(m, UNITS, snap);
  assert.ok(back?.hard);
  // 接著打的結果跟沒中斷過一樣
  assert.deepEqual(autoPlay(back), autoPlay(b));
  const plain = new Battle(m, UNITS);
  plain.start();
  const old = JSON.parse(JSON.stringify(plain.snapshot())) as Record<string, unknown>;
  assert.ok(!('hard' in old), '一般模式的存檔跟加這個功能之前長得一樣');
  assert.equal(Battle.restore(m, UNITS, old)?.hard, false);
});

test('挑戰模式打得過：主線九關把兩條強化線升到兩級、後日談升到滿（都不裝專屬改造），機器人至少有一種打法過關', () => {
  for (const m of MAIN) assert.ok(wins(m, loadout(2), true) > 0, `${m.id}：兩級改造的機器人四種打法都打不過`);
  for (const m of EPILOGUE) assert.ok(wins(m, loadout(TRACK_MAX), true) > 0, `${m.id}：強化線升滿的機器人四種打法都打不過`);
});

test('挑戰模式要求的改造買得起：主線每關兩顆星就夠升到兩級，全部的星夠把強化線升滿', () => {
  const tracks = (lv: number): number => partsSpent(Object.fromEntries(FRAMES.map((f) => [f, { plating: lv, firepower: lv, mods: [] }])));
  assert.ok(tracks(2) <= partsEarned(Object.fromEntries(MAIN.map((m) => [m.id, 2]))));
  assert.ok(tracks(TRACK_MAX) <= partsEarned(Object.fromEntries(MISSIONS.map((m) => [m.id, 3]))));
});

test('挑戰模式真的比較難：沒有改造的話，主線最後一關機器人四種打法都打不過（一般模式打得過）', () => {
  const last = MAIN[MAIN.length - 1];
  assert.ok(wins(last, UNITS, false) > 0);
  assert.equal(wins(last, UNITS, true), 0);
  // 沒有改造的機器人在挑戰模式拿不到任何一關的三顆星
  for (const m of MISSIONS) for (const st of BOT_STYLES) assert.ok(autoPlay(new Battle(m, UNITS, false, true), 40, undefined, st).stars < 3, `${m.id} 沒改造就三星`);
});

test('挑戰模式：主線全部過關才開放；每一關要先過關才能打它的挑戰', () => {
  assert.equal(challengeOpen(R()), false);
  assert.equal(challengeOpen(R({ stars: stars(MAIN.slice(0, -1)) })), false, '還差最後一關');
  const p = R({ stars: stars(MAIN) });
  assert.equal(challengeOpen(p), true);
  assert.ok(MAIN.every((m) => challengeReady(p, m.id)));
  assert.ok(EPILOGUE.every((m) => !challengeReady(p, m.id)), '後日談還沒打過的不能直接打挑戰');
  assert.equal(challengeReady(R({ stars: { ...stars(MAIN), m10: 2 } }), 'm10'), true);
  assert.equal(challengeReady(R({ stars: { m1: 3 } }), 'm1'), false, '主線還沒打完');
});

test('挑戰模式：完成的任務記進清單，不重複記；不存在的任務不記', () => {
  const p = R({ stars: stars(MAIN) });
  assert.equal(markChallenge(p, 'm3'), true);
  assert.equal(markChallenge(p, 'm3'), false);
  assert.equal(markChallenge(p, 'nope'), false);
  assert.deepEqual(p.tips, ['chal_m3']);
  assert.deepEqual([...challengeDone(p)], ['m3']);
  assert.equal(challengeDone(R({ tips: ['chal_removed', 'tip_move', 'ach_fall'] })).size, 0, '存檔裡多出來的記號不算數');
});

test('挑戰模式：徽章跟圖鑑、成就一起放得進存檔的清單，整理和雲端合併之後都還在', () => {
  const all = R({ stars: stars(MISSIONS), tips: Array.from({ length: 13 }, (_, i) => `tip_${i}`) });
  markSeen(all, CODEX.map((c) => c.id));
  grantFeats(all, FEATS.map((f) => f.id));
  for (const m of MISSIONS) markChallenge(all, m.id);
  assert.ok(all.tips.every((t) => t.length <= 40));
  assert.ok(all.tips.length <= 200, `${all.tips.length} 筆`);
  assert.equal(challengeDone(cleanProgress({ ...all, at: 1, epoch: 0 })).size, MISSIONS.length);
  // 兩台裝置各自完成的，合併之後都在
  const a = cleanProgress({ stars: stars(MAIN), tips: ['chal_m1', 'chal_m2'], at: 5 });
  const b = cleanProgress({ stars: stars(MAIN), tips: ['chal_m2', 'chal_m9'], at: 9 });
  assert.deepEqual([...challengeDone(mergeProgress(a, b))].sort(), ['m1', 'm2', 'm9']);
});

test('挑戰模式的成就：第一個、主線全部、全部任務；進度條的數字', () => {
  const p = R({ stars: stars(MISSIONS) });
  const has = (id: string): boolean => stateFeats(p).includes(id);
  assert.ok(!has('chal1') && !has('chalMain') && !has('chalAll'));
  markChallenge(p, 'm4');
  assert.ok(has('chal1') && !has('chalMain'));
  assert.deepEqual(featProgress('chalMain', p), [1, MAIN.length]);
  assert.deepEqual(featProgress('chalAll', p), [1, MISSIONS.length]);
  for (const m of MAIN) markChallenge(p, m.id);
  assert.ok(has('chalMain') && !has('chalAll'));
  assert.deepEqual(featProgress('chalMain', p), [MAIN.length, MAIN.length]);
  for (const m of EPILOGUE) markChallenge(p, m.id);
  assert.ok(has('chalAll'));
  assert.ok(earnedFeats(p).has('chalAll'));
  // 這三個成就都在成就表裡，不另外寫記號
  for (const id of ['chal1', 'chalMain', 'chalAll']) assert.ok(FEATS.some((f) => f.id === id), id);
  assert.ok(!p.tips.some((t) => t.startsWith('ach_')));
});
