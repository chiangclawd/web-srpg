// 後日談（第四章）的新規則：全部摧毀的目標、機群站在我方、護盾投射器、雷霆攻城砲、破門者
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Battle } from '../../src/starfall/sim/Battle';
import { aiTakeTurn } from '../../src/starfall/sim/ai';
import { UNITS } from '../../src/starfall/data/units';
import { MISSIONS } from '../../src/starfall/data/missions';
import { chapterMul, missionParts } from '../../src/starfall/data/upgrades';
import type { MissionDef, SpawnDef, Unit } from '../../src/starfall/sim/types';

function mk(rows: string[], units: SpawnDef[], extra: Partial<MissionDef> = {}): Battle {
  const b = new Battle(
    {
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
    },
    UNITS,
  );
  b.start();
  return b;
}
const P = (unit: string, x: number, y: number, o: Partial<SpawnDef> = {}): SpawnDef => ({ unit, x, y, side: 'player', ...o });
const E = (unit: string, x: number, y: number, o: Partial<SpawnDef> = {}): SpawnDef => ({ unit, x, y, side: 'enemy', ...o });
const u = (b: Battle, id: string, n = 0): Unit => b.units.filter((v) => v.def.id === id)[n];
const OPEN = ['.........', '.........', '.........', '.........', '.........'];
/** 我方全部待機、敵方照 AI 行動，進到下一個我方回合 */
function pass(b: Battle): void {
  b.endPlayerPhase();
  while (b.stepEnemy(aiTakeTurn)) {
    // 敵方行動
  }
  b.beginPlayerPhase();
}

test('全部摧毀：指定的目標要全部打掉才過關，進度看得到；其他敵人不用清光', () => {
  const b = mk(OPEN, [P('kai', 0, 0), E('sentry', 2, 0, { dir: 2, ai: 'hold', tag: 'a' }), E('sentry', 0, 2, { dir: 3, ai: 'hold', tag: 'b' }), E('sentry', 8, 4, { dir: 2, ai: 'hold' })], {
    win: { type: 'killAll', tags: ['a', 'b'] },
  });
  assert.equal(b.killed(), 0);
  u(b, 'sentry', 0).hp = 1;
  u(b, 'sentry', 1).hp = 1;
  b.attack(u(b, 'kai'), u(b, 'sentry', 0));
  assert.equal(b.killed(), 1);
  assert.equal(b.result, null, 'one of two is not enough');
  pass(b);
  b.attack(u(b, 'kai'), u(b, 'sentry', 1));
  assert.equal(b.killed(), 2);
  assert.equal(b.result, 'win', 'the untagged sentry may stay');
  // 其他目標類型沒有這個進度
  assert.equal(mk(OPEN, [P('kai', 0, 0), E('sentry', 8, 4)]).killed(), 0);
});

test('機群站在我方：可以操作，被擊破不算「機體被擊破」；有駕駛員的機體才算', () => {
  const b = mk(OPEN, [P('kai', 0, 0), P('sentry', 4, 2), P('bruno', 0, 4), E('lancer', 5, 2, { dir: 2 }), E('lancer', 1, 4, { dir: 2 })]);
  const drone = u(b, 'sentry');
  assert.ok(b.canAct(drone), 'the allied drone takes orders');
  assert.ok(b.attack(drone, u(b, 'lancer', 0)).length > 0);
  drone.hp = 1;
  u(b, 'bruno').hp = 1;
  pass(b);
  assert.ok(!drone.alive && !u(b, 'bruno').alive);
  assert.equal(b.lost, 1, 'only Bruno counts as a lost frame');
});

test('護盾投射器：3 格內的友軍受到的傷害 -25%，兩座疊加；超出範圍沒有；拆掉就沒了', () => {
  const b = mk(OPEN, [P('kai', 0, 2), E('lancer', 2, 2, { dir: 2, ai: 'hold' }), E('projector', 4, 2), E('projector', 2, 4), E('lancer', 8, 0, { dir: 2, ai: 'hold' })]);
  const kai = u(b, 'kai');
  const near = u(b, 'lancer', 0);
  const far = u(b, 'lancer', 1);
  // 步槍 30，正面打裝甲 3：沒有力場是 27
  const f = b.forecast(kai, near);
  assert.equal(f.dmg, Math.round(30 * (1 - 0.5)) - 3, 'two projectors: -50%');
  u(b, 'projector', 1).alive = false;
  assert.equal(b.forecast(kai, near).dmg, Math.round(30 * (1 - 0.25)) - 3, 'one projector: -25%');
  u(b, 'projector', 0).alive = false;
  assert.equal(b.forecast(kai, near).dmg, 27);
  assert.ok(!b.forecast(kai, far, { x: 6, y: 0 }).mods.some((m) => m.kind === 'guard'), 'out of range of both');
});

test('雷霆攻城砲：射程 4–7、波及旁邊、3 格內打不到；推不動', () => {
  const b = mk(['..........', '..........'], [P('bruno', 3, 0), P('kai', 6, 0), P('vey', 6, 1), E('thunderer', 0, 0, { dir: 0, ai: 'hold' })]);
  const t = u(b, 'thunderer');
  assert.ok(!b.canHit(t, t, 3, 0), 'too close at 3 tiles');
  assert.ok(b.canHit(t, t, 4, 0) && b.canHit(t, t, 7, 0) && !b.canHit(t, t, 8, 0));
  const hp = { kai: u(b, 'kai').hp, vey: u(b, 'vey').hp, bruno: u(b, 'bruno').hp };
  pass(b);
  const hit = [u(b, 'kai'), u(b, 'vey')].filter((v) => v.hp < hp[v.def.id as 'kai' | 'vey']);
  assert.equal(hit.length, 2, 'the target and the unit next to it are both hit');
  assert.equal(u(b, 'bruno').hp, hp.bruno, 'Bruno, 3 tiles away, is untouched');
  // 布魯諾貼上去用震盪砲：受傷但推不動
  b.move(u(b, 'bruno'), 1, 0);
  b.useSkill(u(b, 'bruno'), 'shock', { x: 0, y: 0 });
  assert.deepEqual([t.x, t.y], [0, 0]);
  assert.ok(t.hp < t.maxHp);
});

test('破門者：側擊與背襲的加成加倍', () => {
  const b = mk(OPEN, [P('bruno', 4, 2, { dir: 0 }), E('breacher', 5, 2, { dir: 2 }), E('breacher', 4, 3, { dir: 3 }), E('breacher', 3, 2, { dir: 0 })]);
  const bruno = u(b, 'bruno');
  b.endPlayerPhase();
  const front = b.forecast(u(b, 'breacher', 0), bruno).dmg;
  const side = b.forecast(u(b, 'breacher', 1), bruno).dmg;
  const rear = b.forecast(u(b, 'breacher', 2), bruno).dmg;
  assert.equal(front, 28 - 6);
  assert.equal(side, Math.round(28 * 1.3) - 6);
  assert.equal(rear, Math.round(28 * 1.6) - 6);
});

test('後日談的關卡：比主線大、可操作單位 9 台以上、零件給得更多', () => {
  const ch4 = MISSIONS.filter((m) => m.chapter === 4);
  assert.equal(ch4.length, 3);
  const biggest = Math.max(...MISSIONS.filter((m) => (m.chapter ?? 1) < 4).map((m) => m.tiles.length * m.tiles[0].length));
  for (const m of ch4) {
    assert.ok(m.tiles.length * m.tiles[0].length > biggest * 1.5, `${m.id} is not much bigger than the story maps`);
    const mine = m.units.filter((s) => s.side === 'player' && !UNITS[s.unit].structure);
    assert.ok(mine.length >= 9, `${m.id}: ${mine.length} controllable units`);
    assert.ok(mine.some((s) => !UNITS[s.unit].pilot), `${m.id}: no allied drones`);
    assert.equal(missionParts(m, 3), Math.round(120 * chapterMul(4)));
  }
  assert.equal(chapterMul(4), 2.5);
});
