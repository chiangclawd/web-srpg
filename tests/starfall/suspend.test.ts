// 戰鬥中存檔：存下來再讀回去，接著打的結果要跟沒中斷過一模一樣；壞掉或對不上的存檔要被拒絕。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Battle } from '../../src/starfall/sim/Battle';
import { aiTakeTurn, autoPlay } from '../../src/starfall/sim/ai';
import { UNITS } from '../../src/starfall/data/units';
import { MISSIONS } from '../../src/starfall/data/missions';
import type { BattleEvent, BattleSnap, MissionDef, Unit } from '../../src/starfall/sim/types';

/** 存檔 → 轉成 JSON 字串 → 讀回來（跟實際寫進 localStorage 再讀出來一樣） */
function roundTrip(b: Battle): Battle {
  const snap = b.snapshot();
  assert.ok(snap, '我方回合應該存得下來');
  const again = Battle.restore(b.mission, UNITS, JSON.parse(JSON.stringify(snap)));
  assert.ok(again, '剛存的檔應該讀得回來');
  return again;
}

/**
 * 跟 autoPlay 一樣的打法。swap 在每個我方回合開頭、以及我方每台機體行動之後呼叫，
 * 回傳接下去要用的戰鬥（原本那個，或是存檔再讀回來的新的）。
 */
function play(m: MissionDef, easy: boolean, swap: (b: Battle) => Battle, maxTurns = 40): unknown {
  let b = new Battle(m, UNITS, easy);
  b.start();
  while (!b.result && b.turn <= maxTurns) {
    b = swap(b);
    const order = b
      .alive('player')
      .filter((u) => !u.def.structure)
      .sort((a, c) => Number(a.def.id === 'echo') - Number(c.def.id === 'echo'))
      .map((u) => u.uid);
    for (const uid of order) {
      if (b.result) break;
      const u = b.unit(uid);
      if (!u.alive) continue;
      aiTakeTurn(b, u);
      if (!b.result) b = swap(b);
    }
    if (b.result) break;
    b.endPlayerPhase();
    const enemy = (bb: Battle, e: Unit): BattleEvent[] => aiTakeTurn(bb, e);
    for (let ev = b.stepEnemy(enemy); ev !== null; ev = b.stepEnemy(enemy));
    b.beginPlayerPhase();
  }
  return {
    result: b.result ?? 'timeout',
    turn: b.turn,
    lost: b.lost,
    held: b.held,
    stars: b.stars(),
    units: b.units.map((u) => `${u.uid}:${u.def.id}@${u.x},${u.y} hp${u.hp} ${u.alive ? 'alive' : 'dead'} ${JSON.stringify(u.cds)}`),
  };
}

test('存檔再讀回來接著打：十二關（一般與輕鬆）的結果跟沒中斷過完全一樣', () => {
  for (const m of MISSIONS) {
    for (const easy of [false, true]) {
      const plain = play(m, easy, (b) => b);
      const saved = play(m, easy, roundTrip);
      assert.deepEqual(saved, plain, `${m.id}${easy ? '（輕鬆）' : ''}`);
    }
  }
});

test('敵方回合、戰鬥結束之後不存檔', () => {
  const m = MISSIONS[0];
  const b = new Battle(m, UNITS);
  b.start();
  assert.ok(b.snapshot());
  b.endPlayerPhase();
  assert.equal(b.snapshot(), null, '敵方回合');
  const done = new Battle(m, UNITS);
  assert.equal(autoPlay(done).result, 'win');
  assert.equal(done.snapshot(), null, '已經結束');
});

test('存檔跟戰鬥互不牽連：讀回來的戰鬥改了，存檔不變；退回移動也照樣能用', () => {
  const m = MISSIONS[0];
  const b = new Battle(m, UNITS);
  b.start();
  const kai = b.units.find((u) => u.def.id === 'kai')!;
  const from = { x: kai.x, y: kai.y };
  const to = b.reachable(kai).find((p) => (p.x !== kai.x || p.y !== kai.y) && b.canStop(kai, p.x, p.y))!;
  b.move(kai, to.x, to.y);
  const snap = b.snapshot()!;
  const text = JSON.stringify(snap);
  const again = Battle.restore(m, UNITS, JSON.parse(text))!;
  const k2 = again.units.find((u) => u.def.id === 'kai')!;
  assert.deepEqual({ x: k2.x, y: k2.y, moved: k2.moved }, { x: to.x, y: to.y, moved: true });
  assert.ok(again.undoMove(k2), '移動之後存檔，讀回來還能退回');
  assert.deepEqual({ x: k2.x, y: k2.y, moved: k2.moved }, { ...from, moved: false });
  k2.hp = 1;
  again.turn = 9;
  assert.equal(JSON.stringify(snap), text, '存檔內容沒有被動到');
  assert.equal(JSON.stringify(b.snapshot()), text, '原本那場戰鬥也沒有被動到');
});

test('對不上或壞掉的存檔會被拒絕', () => {
  const m = MISSIONS[0];
  const b = new Battle(m, UNITS);
  b.start();
  const good = (): BattleSnap => JSON.parse(JSON.stringify(b.snapshot())) as BattleSnap;
  assert.ok(Battle.restore(m, UNITS, good()));
  const bad = (label: string, change: (s: BattleSnap) => unknown): void => {
    const s = good();
    const out = change(s);
    assert.equal(Battle.restore(m, UNITS, out === undefined ? s : out), null, label);
  };
  bad('不是物件', () => 'x');
  bad('空的', () => ({}));
  bad('null', () => null);
  bad('版本不對', (s) => void ((s as { v: number }).v = 2));
  bad('別關的存檔', (s) => void (s.mission = 'm2'));
  bad('任務內容改過', (s) => void (s.sig = 'zzz'));
  bad('沒有單位', (s) => void (s.units = []));
  bad('不存在的機型', (s) => void (s.units[0].def = 'nobody'));
  bad('站到地圖外面', (s) => void (s.units[0].x = 99));
  bad('兩台疊在同一格', (s) => void ((s.units[1].x = s.units[0].x), (s.units[1].y = s.units[0].y)));
  bad('編號重複', (s) => void (s.units[1].uid = s.units[0].uid));
  bad('耐久超過上限', (s) => void (s.units[0].hp = s.units[0].maxHp + 50));
  bad('回合數不是整數', (s) => void (s.turn = 1.5));
  bad('陣營不對', (s) => void ((s.units[0] as { side: string }).side = 'neutral'));
  // 任務資料改了（多一台敵人）：指紋不同，同一份存檔就不能用
  const changed: MissionDef = { ...m, units: [...m.units, { unit: 'worker', x: 0, y: 0 }] };
  assert.equal(Battle.restore(changed, UNITS, good()), null, '任務多了一台單位');
});
