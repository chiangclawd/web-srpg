import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Battle, COLLIDE_DMG, COUNTER_MUL, OVERWATCH_MUL } from '../../src/starfall/sim/Battle';
import { aiTakeTurn, autoPlay } from '../../src/starfall/sim/ai';
import { UNITS } from '../../src/starfall/data/units';
import { MISSIONS } from '../../src/starfall/data/missions';
import { STORY } from '../../src/starfall/data/story';
import { SHEETS } from '../../src/starfall/view/sheets';
import { TERRAIN_CHARS } from '../../src/starfall/sim/terrain';
import type { MissionDef, SpawnDef, Unit, WinCondition } from '../../src/starfall/sim/types';

/** 測試用小地圖：rows 是地形、heights 省略就是全平地 */
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
    par: 5,
    ...extra,
  };
  const b = new Battle(m, UNITS);
  b.start();
  return b;
}
const P = (unit: string, x: number, y: number, o: Partial<SpawnDef> = {}): SpawnDef => ({ unit, x, y, side: 'player', ...o });
const E = (unit: string, x: number, y: number, o: Partial<SpawnDef> = {}): SpawnDef => ({ unit, x, y, side: 'enemy', ...o });
const u = (b: Battle, id: string, n = 0): Unit => b.units.filter((v) => v.def.id === id)[n];
const OPEN = ['.......', '.......', '.......', '.......', '.......'];

test('地圖每列寬度不一致、出現不認得的地形字元都會報錯', () => {
  assert.throws(() => mk(['...', '..'], []));
  assert.throws(() => mk(['.?.'], []));
});

test('移動：積雪 2 點、爬一層多 1 點、一次爬不了兩層、艙壁不能走', () => {
  const b = mk(['..s....', '.......', '...#...'], [P('kai', 0, 0), E('worker', 6, 2)], { heights: ['0000120', '0000000', '0000000'] });
  const k = u(b, 'kai');
  // 給足移動力看每一格的實際消耗
  const r = b.moveRange(k, 10);
  assert.equal(r.get(b.key(1, 0))?.cost, 1);
  assert.equal(r.get(b.key(2, 0))?.cost, 3, 'snow costs 2');
  assert.equal(r.get(b.key(3, 0))?.cost, 4);
  assert.equal(r.get(b.key(4, 0))?.cost, 6, 'one step + one level of climb');
  assert.equal(r.get(b.key(5, 0))?.cost, 8, 'only reachable from the height-1 tile; (5,1) → (5,0) would be a two-level climb');
  assert.ok(!r.has(b.key(3, 2)), 'bulkhead');
  // 凱的移動力是 5：爬不上那塊高地
  const real = b.moveRange(k);
  assert.ok(real.has(b.key(4, 1)) && !real.has(b.key(4, 0)) && !real.has(b.key(5, 0)));
});

test('移動：敵人擋路、友軍可以穿過但不能停在上面', () => {
  const b = mk(['.....'], [P('kai', 0, 0), P('bruno', 1, 0), E('worker', 3, 0)]);
  const k = u(b, 'kai');
  const r = b.moveRange(k);
  assert.ok(r.has(b.key(2, 0)), 'through the ally');
  assert.ok(!r.has(b.key(3, 0)) && !r.has(b.key(4, 0)), 'the enemy blocks the corridor');
  assert.ok(!b.canStop(k, 1, 0));
  assert.deepEqual(b.move(k, 1, 0), []);
});

test('懸浮：無視積雪、可以越過裂谷但不能停在裂谷上', () => {
  const b = mk(['.s~~.'], [P('echo', 0, 0), P('kai', 0, 0), E('worker', 4, 0)].slice(0, 1).concat([E('worker', 4, 0, { ai: 'hold' })]));
  const e = u(b, 'echo');
  const r = b.moveRange(e);
  assert.equal(r.get(b.key(1, 0))?.cost, 1);
  assert.equal(r.get(b.key(3, 0))?.cost, 3);
  assert.ok(!b.canStop(e, 2, 0));
  assert.ok(!b.reachable(e).some((p) => p.x === 2 || p.x === 3));
});

test('火線：艙壁擋住直射、曲射打得過去；佔高處直射多 1 格射程', () => {
  const b = mk(['..#....', '.......'], [P('kai', 0, 0), E('weaver', 5, 0, { ai: 'hold' }), E('sentry', 4, 1, { ai: 'hold' })], { heights: ['1100000', '1100000'] });
  const k = u(b, 'kai');
  assert.ok(!b.lineClear(1, 0, 5, 0), 'bulkhead in the way');
  assert.ok(b.canHit(u(b, 'weaver'), { x: 5, y: 0 }, 1, 0), 'mortar arcs over (distance 4)');
  // 凱射程 1–3；(1,1) 高 1 打 (4,1) 高 0：距離 3 打得到，(0,1) 距離 4 靠高度 +1 也打得到
  assert.ok(b.canHit(k, { x: 1, y: 1 }, 4, 1));
  assert.ok(b.canHit(k, { x: 0, y: 1 }, 4, 1), 'high ground adds 1 range');
  const flat = mk(['.......'], [P('kai', 0, 0), E('sentry', 4, 0, { ai: 'hold' })]);
  assert.ok(!flat.canHit(u(flat, 'kai'), { x: 0, y: 0 }, 4, 0), 'no bonus on level ground');
});

test('傷害：正面是基本值減裝甲，側面 +15%、背後 +30%', () => {
  const dmg = (kx: number, ky: number): number => {
    const b = mk(OPEN, [P('kai', kx, ky), E('sentry', 3, 2, { dir: 2, ai: 'hold' })]);
    return b.forecast(u(b, 'kai'), u(b, 'sentry')).dmg;
  };
  // 哨兵面向 -x：凱在它左邊是正面
  assert.equal(dmg(1, 2), 30 - 2);
  assert.equal(dmg(3, 0), Math.round(30 * 1.15) - 2, 'side');
  assert.equal(dmg(5, 2), Math.round(30 * 1.3) - 2, 'rear');
});

test('傷害：高打低 +15%、低打高 -10%；掩體只擋兩格以上的直射', () => {
  const b = mk(['..b....'], [P('kai', 0, 0), E('sentry', 2, 0, { dir: 2, ai: 'hold' })]);
  const k = u(b, 'kai');
  const s = u(b, 'sentry');
  assert.equal(b.forecast(k, s).dmg, Math.round(30 * 0.6) - 2, 'heavy cover at range 2');
  assert.equal(b.forecast(k, s, { x: 1, y: 0 }).dmg, 30 - 2, 'adjacent ignores cover');
  const hi = mk(['.....'], [P('kai', 0, 0), E('sentry', 2, 0, { dir: 2, ai: 'hold' })], { heights: ['10000'] });
  assert.equal(hi.forecast(u(hi, 'kai'), u(hi, 'sentry')).dmg, Math.round(30 * 1.15) - 2);
  assert.equal(hi.forecast(u(hi, 'sentry'), u(hi, 'kai')).dmg, Math.round(22 * 0.9) - 2);
});

test('光環：凱旁邊的友軍傷害 +10%，布魯諾旁邊的友軍受傷 -20%', () => {
  const b = mk(OPEN, [P('kai', 1, 1), P('bruno', 1, 2), E('sentry', 3, 2, { dir: 2, ai: 'hold' })]);
  const br = u(b, 'bruno');
  const s = u(b, 'sentry');
  assert.equal(b.forecast(br, s).dmg, Math.round(38 * 1.1) - 2, 'Kai is adjacent to Bruno');
  assert.equal(b.forecast(s, u(b, 'kai')).dmg, Math.round(22 * 0.8) - 2, 'Bruno guards Kai');
});

test('預估的數字就是實際結果（含反擊）', () => {
  const b = mk(OPEN, [P('kai', 1, 2), E('sentry', 3, 2, { dir: 2, ai: 'hold' })]);
  const k = u(b, 'kai');
  const s = u(b, 'sentry');
  const f = b.forecast(k, s);
  assert.ok(f.counter, 'the sentry is in range to counter');
  b.attack(k, s);
  assert.equal(s.hp, 60 - f.dmg);
  assert.equal(k.hp, 100 - f.counter!.dmg);
  assert.equal(f.counter!.dmg, Math.round(22 * COUNTER_MUL) - 2);
});

test('反擊：射程外不會反擊；被打之後轉身面向攻擊者', () => {
  const b = mk(OPEN, [P('vey', 0, 2), E('worker', 4, 2, { dir: 0, ai: 'hold' })]);
  const v = u(b, 'vey');
  const w = u(b, 'worker');
  assert.equal(b.forecast(v, w).counter, null, 'melee cannot reach');
  // 從背後打（工蜂面向 +x）
  const f = b.forecast(v, w);
  assert.ok(f.mods.some((m) => m.kind === 'flank' && m.value === 30));
  const ev = b.attack(v, w);
  assert.ok(!ev.some((e) => e.t === 'attack' && e.kind === 'counter'));
  if (w.alive) assert.equal(w.dir, 2);
});

test('警戒：敵人走進射程挨一槍（傷害 80%、只有一次），之後不能退回移動', () => {
  const b = mk(['.......'], [P('kai', 0, 0), E('sentry', 6, 0, { dir: 2 })]);
  const k = u(b, 'kai');
  const s = u(b, 'sentry');
  assert.equal(b.setOverwatch(k).length, 1);
  assert.ok(k.overwatch && k.acted);
  b.endPlayerPhase();
  // 哨兵走進凱的射程（距離 3）
  const ev = b.move(s, 3, 0);
  const shot = ev.find((e) => e.t === 'attack');
  assert.ok(shot && shot.t === 'attack' && shot.kind === 'overwatch');
  assert.equal(s.hp, 60 - (Math.round(30 * OVERWATCH_MUL) - 2));
  assert.ok(!k.overwatch, 'spent');
  assert.equal(s.x, 3, 'survivor finishes the move');
  assert.ok(!b.undoMove(s));
});

test('警戒可以打死走到一半的敵人：它停在中槍的那一格', () => {
  const b = mk(['.......'], [P('vey', 0, 0), E('worker', 6, 0, { dir: 2 })]);
  const w = u(b, 'worker');
  w.hp = 10;
  b.setOverwatch(u(b, 'vey'));
  b.endPlayerPhase();
  b.move(w, 2, 0);
  assert.ok(!w.alive);
  assert.equal(w.x, 5, 'shot as soon as it entered range 5');
  assert.equal(b.result, 'win');
});

test('退回移動：行動前可以退回，行動後不行', () => {
  const b = mk(OPEN, [P('kai', 0, 0), E('sentry', 6, 4, { ai: 'hold' })]);
  const k = u(b, 'kai');
  b.move(k, 2, 0);
  assert.ok(k.moved);
  assert.ok(b.undoMove(k));
  assert.deepEqual([k.x, k.y, k.moved], [0, 0, false]);
  b.move(k, 2, 0);
  b.wait(k);
  assert.ok(!b.undoMove(k));
  assert.deepEqual(b.move(k, 3, 0), [], 'no second move');
});

test('集火射擊：傷害 ×1.6、不會被反擊、冷卻 3 回合', () => {
  const b = mk(OPEN, [P('kai', 1, 2), E('sentry', 3, 2, { dir: 2, ai: 'hold' })]);
  const k = u(b, 'kai');
  const s = u(b, 'sentry');
  const ev = b.useSkill(k, 'focus', { x: 3, y: 2 });
  assert.equal(s.hp, 60 - (Math.round(30 * 1.6) - 2));
  assert.ok(!ev.some((e) => e.t === 'attack' && e.kind === 'counter'));
  assert.equal(k.hp, 100);
  // 之後的 3 個我方回合都不能用，第 4 個才行
  const ready: boolean[] = [];
  for (let i = 0; i < 4; i++) {
    b.endPlayerPhase();
    while (b.stepEnemy(() => [])) {
      // 敵方待機
    }
    b.beginPlayerPhase();
    ready.push(b.skillReady(k, k.def.skills[0]));
  }
  assert.deepEqual(ready, [false, false, false, true]);
});

test('震盪砲：推開一格；撞牆追加傷害；推進裂谷直接摧毀；首領推不動', () => {
  const push = (rows: string[], foe = 'sentry'): { b: Battle; t: Unit } => {
    const b = mk(rows, [P('bruno', 0, 0), E(foe, 1, 0, { dir: 2, ai: 'hold' }), E('worker', 4, 0, { ai: 'hold' })]);
    b.useSkill(u(b, 'bruno'), 'shock', { x: 1, y: 0 });
    return { b, t: u(b, foe) };
  };
  const base = 38 - 2;
  let r = push(['.....']);
  assert.deepEqual([r.t.x, r.t.hp], [2, 60 - base]);
  r = push(['..#..']);
  assert.deepEqual([r.t.x, r.t.hp], [1, 60 - base - COLLIDE_DMG], 'slammed into the bulkhead');
  r = push(['..~..']);
  assert.ok(!r.t.alive, 'fell into the chasm');
  r = push(['..~..'], 'shepherd');
  assert.ok(r.t.alive && r.t.x === 1, 'bosses do not budge');
});

test('貫穿射擊：打到直線上所有敵人，碰到艙壁就停', () => {
  const b = mk(['......#.'], [P('vey', 0, 0), E('worker', 2, 0, { ai: 'hold' }), E('worker', 4, 0, { ai: 'hold' }), E('sentry', 7, 0, { ai: 'hold' })]);
  const v = u(b, 'vey');
  assert.deepEqual(
    b.lineTiles(v, { x: 1, y: 0 }, v.def.skills[0]).map((p) => p.x),
    [1, 2, 3, 4, 5],
  );
  b.useSkill(v, 'pierce', { x: 1, y: 0 });
  assert.ok(!u(b, 'worker', 0).alive && !u(b, 'worker', 1).alive);
  assert.equal(u(b, 'sentry').hp, 60, 'behind the bulkhead');
});

test('修復不會超過上限；超載駭入讓敵人跳過一回合、不能反擊，首領免疫', () => {
  const b = mk(OPEN, [P('echo', 1, 2), P('kai', 1, 1), E('sentry', 3, 2, { dir: 2 }), E('shepherd', 4, 4, { ai: 'hold' })]);
  const e = u(b, 'echo');
  const k = u(b, 'kai');
  const s = u(b, 'sentry');
  k.hp = 85;
  assert.ok(!b.skillTargets(e, e.def.skills[1]).some((p) => p.x === 4 && p.y === 4), 'cannot target the boss');
  b.useSkill(e, 'overload', { x: 3, y: 2 });
  assert.equal(s.stun, 1);
  assert.equal(b.forecast(k, s).counter, null, 'a disabled unit cannot counter');
  b.endPlayerPhase();
  let acted = 0;
  while (b.stepEnemy((bb, x) => (x === s ? (acted++, bb.wait(x)) : bb.wait(x)))) {
    // 哨兵被癱瘓：不會輪到 AI
  }
  assert.equal(acted, 0);
  b.beginPlayerPhase();
  assert.equal(s.stun, 0, 'wears off after its skipped turn');
  b.useSkill(e, 'repair', { x: 1, y: 1 });
  assert.equal(k.hp, 100, 'capped at max');
});

test('勝敗：全滅要等增援出完；隊長被擊破就失敗', () => {
  const b = mk(OPEN, [P('kai', 1, 2), E('worker', 2, 2, { dir: 0, ai: 'hold' })], { events: [{ turn: 2, spawn: [{ unit: 'worker', x: 6, y: 4, ai: 'hold' }] }] });
  const k = u(b, 'kai');
  u(b, 'worker').hp = 5;
  b.attack(k, u(b, 'worker'));
  assert.equal(b.result, null, 'a reinforcement wave is still due');
  b.endPlayerPhase();
  while (b.stepEnemy(aiTakeTurn)) {
    // 沒有敵人
  }
  const ev = b.beginPlayerPhase();
  assert.ok(ev.some((e) => e.t === 'spawn'));
  assert.equal(b.turn, 2);
  u(b, 'worker', 1).hp = 0;
  const lose = mk(OPEN, [P('kai', 1, 2), P('bruno', 0, 0), E('sentry', 3, 2, { dir: 2 })]);
  u(lose, 'kai').hp = 5;
  lose.endPlayerPhase();
  while (lose.stepEnemy(aiTakeTurn)) {
    // 哨兵開火
  }
  assert.equal(lose.result, 'lose');
});

test('防守關：撐過指定回合就贏；保護目標被摧毀就輸；第三顆星看目標剩餘耐久', () => {
  const win: WinCondition = { type: 'survive', turns: 2 };
  const b = mk(OPEN, [P('kai', 0, 0), P('generator', 3, 2, { tag: 'gen' }), E('worker', 6, 4, { ai: 'hold' })], { win, protect: ['gen'] });
  for (let i = 0; i < 2 && !b.result; i++) {
    b.endPlayerPhase();
    while (b.stepEnemy(aiTakeTurn)) {
      // 敵方原地不動
    }
    b.beginPlayerPhase();
  }
  assert.equal(b.result, 'win');
  assert.equal(b.stars(), 3);
  const c = mk(OPEN, [P('kai', 0, 0), P('generator', 3, 2, { tag: 'gen' }), E('worker', 4, 2, { dir: 2 })], { win, protect: ['gen'] });
  c.byTag('gen')!.hp = 10;
  c.endPlayerPhase();
  while (c.stepEnemy(aiTakeTurn)) {
    // 工蜂打發電機
  }
  assert.equal(c.result, 'lose');
});

test('AI：守備單位在敵人靠近前不動；主動單位會靠近並攻擊；不會走到別人身上', () => {
  const b = mk(['.........', '.........'], [P('kai', 0, 0), E('sentry', 8, 0, { ai: 'guard', dir: 2 }), E('worker', 8, 1, { dir: 2 }), E('worker', 7, 1, { dir: 2 })]);
  b.endPlayerPhase();
  while (b.stepEnemy(aiTakeTurn)) {
    // 敵方行動
  }
  const s = u(b, 'sentry');
  assert.deepEqual([s.x, s.y], [8, 0], 'guard holds (Kai is 8 tiles away)');
  assert.ok(s.overwatch);
  assert.ok(u(b, 'worker', 0).x < 8 && u(b, 'worker', 1).x < 7, 'workers advance');
  const seen = new Set<string>();
  for (const v of b.units) {
    assert.ok(!seen.has(`${v.x},${v.y}`), 'no two units share a tile');
    seen.add(`${v.x},${v.y}`);
  }
});

test('三個任務：資料完整，自動對戰（雙方都是 AI）打得過', () => {
  for (const m of MISSIONS) {
    const b = new Battle(m, UNITS);
    const seen = new Set<string>();
    for (const v of b.units) {
      const t = b.terrainAt(v.x, v.y);
      assert.ok(t !== 'wall' && t !== 'chasm', `${m.id}: ${v.def.id} starts on ${t}`);
      assert.ok(!seen.has(`${v.x},${v.y}`), `${m.id}: two units start on ${v.x},${v.y}`);
      seen.add(`${v.x},${v.y}`);
      assert.ok(SHEETS[v.def.sprite] || v.def.sprite === 'generator', `${m.id}: no sheet for ${v.def.sprite}`);
    }
    for (const e of m.events ?? []) {
      for (const s of e.spawn ?? []) assert.ok(UNITS[s.unit] && b.inMap(s.x, s.y), `${m.id}: bad spawn ${s.unit}`);
      if (e.say) assert.ok(STORY[e.say]?.length, `${m.id}: missing dialogue ${e.say}`);
    }
    for (const id of [m.intro, m.outro]) if (id) assert.ok(STORY[id]?.length, `${m.id}: missing dialogue ${id}`);
    for (const row of m.tiles) for (const ch of row) assert.ok(TERRAIN_CHARS[ch], `${m.id}: terrain ${ch}`);
    const r = autoPlay(b);
    assert.equal(r.result, 'win', `${m.id}: the bot should be able to clear it (got ${r.result} on turn ${r.turns})`);
  }
});

test('文字：每個名稱、說明、對話都有中文和英文', () => {
  const check = (o: unknown, where: string): void => {
    if (!o || typeof o !== 'object') return;
    const r = o as Record<string, unknown>;
    if (typeof r.zh === 'string' || typeof r.en === 'string') {
      assert.ok(typeof r.zh === 'string' && typeof r.en === 'string' && (r.zh === '' || r.en !== ''), `${where}: missing a language`);
      return;
    }
    for (const [k, v] of Object.entries(r)) check(v, `${where}.${k}`);
  };
  check(UNITS, 'UNITS');
  check(MISSIONS, 'MISSIONS');
  check(STORY, 'STORY');
});
