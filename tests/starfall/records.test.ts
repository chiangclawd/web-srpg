// 圖鑑和成就：哪些機體算遇過、成就什麼時候算達成；記號放進存檔的清單之後，存檔整理和雲端合併都要留得住。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Battle } from '../../src/starfall/sim/Battle';
import { UNITS } from '../../src/starfall/data/units';
import { MISSIONS, missionById } from '../../src/starfall/data/missions';
import { CODEX } from '../../src/starfall/data/codex';
import { FEATS } from '../../src/starfall/data/achievements';
import { MODS } from '../../src/starfall/data/upgrades';
import { cleanProgress, mergeProgress } from '../../src/starfall/cloud/merge';
import { SHEETS } from '../../src/starfall/view/sheets';
import { earnedFeats, featProgress, featsIn, firstMission, grantFeats, markSeen, missionUnits, seenUnits, stateFeats, winFeats } from '../../src/starfall/records';
import type { Records } from '../../src/starfall/records';
import type { BattleEvent, MissionDef, SpawnDef, Unit } from '../../src/starfall/sim/types';

const R = (p: Partial<Records> = {}): Records => ({ stars: {}, tips: [], upgrades: {}, ...p });
const ALL3 = Object.fromEntries(MISSIONS.map((m) => [m.id, 3]));

function mk(rows: string[], units: SpawnDef[], extra: Partial<MissionDef> = {}): Battle {
  const m: MissionDef = {
    id: 'test',
    name: { zh: '測試', en: 'Test' },
    brief: { zh: '', en: '' },
    tiles: rows,
    heights: rows.map((r) => '0'.repeat(r.length)),
    units,
    win: { type: 'rout' },
    objective: { zh: '', en: '' },
    par: 6,
    ...extra,
  };
  const b = new Battle(m, UNITS);
  b.start();
  return b;
}
const P = (unit: string, x: number, y: number, o: Partial<SpawnDef> = {}): SpawnDef => ({ unit, x, y, side: 'player', ...o });
const E = (unit: string, x: number, y: number, o: Partial<SpawnDef> = {}): SpawnDef => ({ unit, x, y, side: 'enemy', ...o });
const u = (b: Battle, id: string, n = 0): Unit => b.units.filter((v) => v.def.id === id)[n];
const hit = (a: Unit, t: Unit, o: Partial<Extract<BattleEvent, { t: 'attack' }>> = {}): BattleEvent => ({ t: 'attack', uid: a.uid, target: t.uid, at: { x: t.x, y: t.y }, kind: 'weapon', dmg: 10, mods: [], hp: 0, killed: true, ...o });

test('圖鑑：每一種機體和設施都有一則，而且只有一則', () => {
  assert.deepEqual([...CODEX.map((c) => c.id)].sort(), Object.keys(UNITS).sort());
  for (const c of CODEX) {
    assert.ok(c.note.zh.length > 8 && c.note.en.length > 16, `${c.id} 沒有介紹`);
    assert.ok(firstMission(c.id) >= 0, `${c.id} 沒有任何任務用到，圖鑑永遠開不了`);
  }
});

test('圖鑑：圖集裡有每一種機體的圖（發電機是程序繪圖，不在圖集裡）', () => {
  const frames = (JSON.parse(readFileSync('public/assets/starfall/codex.json', 'utf8')) as { frames: Record<string, unknown> }).frames;
  for (const c of CODEX) {
    const sprite = UNITS[c.id].sprite;
    if (SHEETS[sprite]) assert.ok(frames[sprite], `codex.webp 裡沒有 ${sprite}（重跑 node scripts/art/starfall-codex.mjs）`);
  }
});

test('圖鑑：過關的任務裡出現的機體都算遇過，增援也算；沒打過的不算', () => {
  assert.equal(seenUnits(R()).size, 0);
  const m1 = seenUnits(R({ stars: { m1: 1 } }));
  assert.deepEqual([...m1].sort(), [...missionUnits(missionById('m1'))].sort());
  assert.ok(m1.has('kai') && m1.has('worker') && !m1.has('vey') && !m1.has('weaver'));
  // 第二關的薇和織網者是第三、四回合才出來的增援
  const m2 = seenUnits(R({ stars: { m2: 2 } }));
  assert.ok(m2.has('vey') && m2.has('weaver') && m2.has('generator'));
  assert.equal(seenUnits(R({ stars: ALL3 })).size, CODEX.length);
});

test('圖鑑：戰鬥中遇到的記進清單；已經算遇過的不重複記，不認得的編號不記', () => {
  const p = R({ stars: { m1: 1 } });
  assert.equal(markSeen(p, ['kai', 'worker']), false, '過關的任務裡就有，不用另外記');
  assert.deepEqual(p.tips, []);
  assert.equal(markSeen(p, ['lancer', 'lancer', 'bastion', 'nobody']), true);
  assert.deepEqual(p.tips, ['seen_lancer', 'seen_bastion']);
  assert.equal(markSeen(p, ['lancer']), false);
  assert.ok(seenUnits(p).has('lancer') && seenUnits(p).has('bastion') && !seenUnits(p).has('nobody'));
  // 存檔裡多出來的舊記號不算數
  assert.ok(!seenUnits(R({ tips: ['seen_removed_unit'] })).has('removed_unit'));
});

test('成就：編號不重複，記號放得進存檔的清單（每筆 40 字以內、總數 200 筆以內）', () => {
  assert.equal(new Set(FEATS.map((f) => f.id)).size, FEATS.length);
  const all = R({ tips: Array.from({ length: 13 }, (_, i) => `tip_${i}`) });
  markSeen(all, CODEX.map((c) => c.id));
  grantFeats(all, FEATS.map((f) => f.id));
  assert.ok(all.tips.every((t) => t.length <= 40));
  assert.ok(all.tips.length <= 200);
  // 整理過（匯入、雲端讀回來）一筆都不能少
  const clean = cleanProgress({ ...all, at: 1, epoch: 0 });
  assert.deepEqual([...clean.tips].sort(), [...all.tips].sort());
  assert.equal(earnedFeats(clean).size, FEATS.length);
  assert.equal(seenUnits(clean).size, CODEX.length);
});

test('成就：兩台裝置各自達成的，合併之後都在', () => {
  const a = cleanProgress({ stars: { m1: 2 }, tips: ['tip_move', 'ach_fall', 'seen_lancer'], at: 5 });
  const b = cleanProgress({ stars: { m1: 1 }, tips: ['ach_counter', 'seen_bastion'], at: 9 });
  const m = mergeProgress(a, b);
  assert.deepEqual([...earnedFeats(m)].sort(), ['counter', 'fall']);
  assert.ok(seenUnits(m).has('lancer') && seenUnits(m).has('bastion'));
});

test('成就：章節和星數直接看進度（加這個功能之前的存檔也算）', () => {
  assert.deepEqual(stateFeats(R()), []);
  assert.deepEqual(stateFeats(R({ stars: { m1: 1, m2: 1 } })), []);
  assert.deepEqual(stateFeats(R({ stars: { m1: 1, m2: 1, m3: 1 } })), ['ch1']);
  assert.deepEqual(stateFeats(R({ stars: { m1: 3 } })), ['star3']);
  const six = Object.fromEntries(MISSIONS.slice(0, 6).map((m) => [m.id, 3]));
  assert.deepEqual(stateFeats(R({ stars: six })).sort(), ['ch1', 'ch2', 'star3', 'stars18']);
  const all = stateFeats(R({ stars: ALL3 }));
  for (const id of ['ch1', 'ch2', 'ch3', 'ch4', 'star3', 'stars18', 'stars36', 'codex']) assert.ok(all.includes(id), id);
  // 只差一顆星就不算全滿
  assert.ok(!stateFeats(R({ stars: { ...ALL3, m12: 2 } })).includes('stars36'));
  // 存檔裡不存在的任務不算星
  assert.ok(!stateFeats(R({ stars: { old1: 3, old2: 3, old3: 3, old4: 3, old5: 3, old6: 3 } })).includes('stars18'));
});

test('成就：專屬改造和一台機體全部裝滿', () => {
  const mods = MODS.filter((m) => m.frame === 'kai').map((m) => m.id);
  assert.ok(mods.length > 0);
  assert.deepEqual(stateFeats(R({ upgrades: { kai: { plating: 3, firepower: 3, mods: [] } } })), []);
  assert.deepEqual(stateFeats(R({ upgrades: { kai: { plating: 0, firepower: 0, mods: [mods[0]] } } })), ['mod']);
  assert.deepEqual(stateFeats(R({ upgrades: { kai: { plating: 3, firepower: 3, mods } } })).sort(), ['maxed', 'mod']);
  assert.deepEqual(featProgress('maxed', R({ upgrades: { kai: { plating: 2, firepower: 1, mods: [] }, bruno: { plating: 1, firepower: 0, mods: [] } } })), [3, 6 + mods.length]);
});

test('成就：進度條的數字', () => {
  assert.deepEqual(featProgress('stars18', R({ stars: { m1: 3, m2: 2 } })), [5, 18]);
  assert.deepEqual(featProgress('stars18', R({ stars: ALL3 })), [18, 18]);
  assert.deepEqual(featProgress('stars36', R({ stars: { m1: 3 } })), [3, MISSIONS.length * 3]);
  assert.deepEqual(featProgress('ch1', R({ stars: { m1: 1, m3: 2 } })), [2, 3]);
  assert.deepEqual(featProgress('codex', R()), [0, CODEX.length]);
  assert.equal(featProgress('fall', R()), null);
});

test('成就：戰鬥中達成的記進清單，不重複記；不存在的編號不記', () => {
  const p = R({ stars: { m1: 3 } });
  assert.equal(grantFeats(p, ['star3']), false, '從進度就算得出來，不用另外記');
  assert.equal(grantFeats(p, ['fall', 'fall', 'nope']), true);
  assert.deepEqual(p.tips, ['ach_fall']);
  assert.equal(grantFeats(p, ['fall']), false);
  assert.deepEqual([...earnedFeats(p)].sort(), ['fall', 'star3']);
  assert.ok(!earnedFeats(R({ tips: ['ach_removed'] })).has('removed'));
});

test('戰術成就：把敵人轟進裂谷（用真的震盪砲）', () => {
  const b = mk(['....~', '.....'], [P('kai', 0, 1), P('bruno', 2, 0), E('sentry', 3, 0), E('worker', 4, 1)]);
  const ev = b.useSkill(u(b, 'bruno'), 'shock', { x: 3, y: 0 });
  assert.ok(ev.some((e) => e.t === 'push' && e.fell), '哨兵應該掉下去');
  assert.deepEqual(featsIn(ev, b), ['fall']);
  // 撞牆不算
  const c = mk(['....#', '.....'], [P('kai', 0, 1), P('bruno', 2, 0), E('sentry', 3, 0), E('sentry', 4, 1)]);
  assert.deepEqual(featsIn(c.useSkill(u(c, 'bruno'), 'shock', { x: 3, y: 0 }), c), []);
});

test('戰術成就：貫穿射擊打中三個、一次行動擊破兩個（用真的貫穿射擊）', () => {
  const b = mk(['.......', '.......'], [P('kai', 0, 1), P('vey', 0, 0), E('worker', 2, 0), E('worker', 3, 0), E('worker', 4, 0), E('sentry', 6, 1)]);
  for (const w of b.units.filter((v) => v.def.id === 'worker')) w.hp = 5;
  const ev = b.useSkill(u(b, 'vey'), 'pierce', { x: 1, y: 0 });
  assert.equal(ev.filter((e) => e.t === 'attack').length, 3);
  assert.deepEqual(featsIn(ev, b).sort(), ['double', 'pierce3']);
  // 只打到兩個、只倒一個：都不算
  const c = mk(['.......', '.......'], [P('kai', 0, 1), P('vey', 0, 0), E('worker', 2, 0), E('warden', 3, 0), E('sentry', 6, 1)]);
  u(c, 'worker').hp = 5;
  assert.deepEqual(featsIn(c.useSkill(u(c, 'vey'), 'pierce', { x: 1, y: 0 }), c), []);
});

test('戰術成就：警戒射擊、反擊擊破敵人才算；敵人這樣打倒我方不算', () => {
  const b = mk(['.....', '.....'], [P('kai', 0, 0), P('bruno', 1, 0), E('worker', 3, 0), E('lancer', 4, 0)]);
  const kai = u(b, 'kai');
  const worker = u(b, 'worker');
  assert.deepEqual(featsIn([hit(kai, worker, { kind: 'overwatch' })], b), ['overwatch']);
  assert.deepEqual(featsIn([hit(kai, worker, { kind: 'counter' })], b), ['counter']);
  assert.deepEqual(featsIn([hit(kai, worker, { kind: 'overwatch', killed: false, hp: 3 })], b), []);
  assert.deepEqual(featsIn([hit(worker, kai, { kind: 'overwatch' })], b), []);
  assert.deepEqual(featsIn([hit(u(b, 'lancer'), u(b, 'bruno'), { kind: 'counter' }), hit(worker, kai)], b), []);
  // 普通攻擊擊破一個：沒有成就
  assert.deepEqual(featsIn([hit(kai, worker)], b), []);
});

test('戰術成就：從側面或背後擊破堡壘才算繞過塔盾', () => {
  const b = mk(['.....', '.....'], [P('kai', 0, 0), E('bastion', 2, 0, { dir: 2 }), E('sentry', 4, 1)]);
  const kai = u(b, 'kai');
  const bastion = u(b, 'bastion');
  bastion.hp = 1;
  // 堡壘面向 -x，凱在它的正面：打得倒也不算
  const front = b.attack(kai, bastion);
  assert.ok(front.some((e) => e.t === 'attack' && e.killed));
  assert.deepEqual(featsIn(front, b), []);
  const c = mk(['.....', '.....'], [P('kai', 0, 0), E('bastion', 2, 0, { dir: 0 }), E('sentry', 4, 1)]);
  u(c, 'bastion').hp = 1;
  assert.deepEqual(featsIn(c.attack(u(c, 'kai'), u(c, 'bastion')), c), ['shield']);
});

test('過關成就：還沒贏不算；提早三回合、全員滿耐久', () => {
  const b = mk(['.....'], [P('kai', 0, 0), P('bruno', 1, 0), E('worker', 4, 0)]);
  assert.deepEqual(winFeats(b), []);
  b.result = 'win';
  b.turn = 3;
  assert.deepEqual(winFeats(b).sort(), ['fullhp', 'swift']);
  b.turn = 4;
  assert.deepEqual(winFeats(b), ['fullhp'], '標準 6 回合，第 4 回合才打完不算提早三回合');
  u(b, 'bruno').hp -= 1;
  assert.deepEqual(winFeats(b), []);
  // 防守任務沒有「提早」
  const d = mk(['.....'], [P('kai', 0, 0), E('worker', 4, 0)], { win: { type: 'survive', turns: 6 } });
  d.result = 'win';
  d.turn = 1;
  assert.deepEqual(winFeats(d), ['fullhp']);
});

test('過關成就：保護的設施沒受傷、借來的機群一台都沒少', () => {
  const b = mk(['......'], [P('kai', 0, 0), P('generator', 1, 0, { tag: 'gen' }), P('sentry', 2, 0), P('worker', 3, 0), E('lancer', 5, 0)], { protect: ['gen'], par: 1 });
  b.result = 'win';
  b.turn = 5;
  assert.deepEqual(winFeats(b).sort(), ['drones', 'fullhp', 'guard']);
  u(b, 'generator').hp -= 1;
  assert.deepEqual(winFeats(b).sort(), ['drones', 'fullhp']);
  const w = u(b, 'worker');
  w.alive = false;
  w.hp = 0;
  assert.deepEqual(winFeats(b), ['fullhp'], '機群沒有駕駛員，倒了不影響「完好歸隊」');
  // 保護的是機體（不是設施）的任務，沒有「滴水不漏」
  const c = mk(['.....'], [P('kai', 0, 0), P('echo', 1, 0, { tag: 'echo' }), E('lancer', 4, 0)], { protect: ['echo'], par: 1 });
  c.result = 'win';
  c.turn = 5;
  assert.deepEqual(winFeats(c), ['fullhp']);
});

test('每一個成就都做得到：戰術和過關的成就在自動對戰的十二關裡至少要有條件成立的任務', () => {
  // 裂谷 + 推得動的敵人、堡壘、有設施要保護、有借來的機群：這些成就靠的東西關卡裡真的有
  const has = (f: (m: MissionDef) => boolean): boolean => MISSIONS.some(f);
  assert.ok(has((m) => m.tiles.join('').includes('~')), '沒有任何任務有裂谷');
  assert.ok(has((m) => missionUnits(m).includes('bastion')), '沒有任何任務有堡壘');
  assert.ok(has((m) => (m.protect ?? []).some((t) => m.units.some((s) => s.tag === t && UNITS[s.unit].structure))), '沒有任何任務要保護設施');
  assert.ok(has((m) => m.units.some((s) => s.side === 'player' && !UNITS[s.unit].pilot && !UNITS[s.unit].structure)), '沒有任何任務有借來的機群');
  assert.ok(has((m) => m.win.type !== 'survive' && m.win.type !== 'hold' && m.par > 3), '沒有任何任務能提早三回合');
});
