import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SELL_RATIO } from '../../src/td/sim/World';
import { TOWERS } from '../../src/td/data/towers';
import { mkWorld, testLevel } from './helpers';

test('build spends gold and occupies the spot', () => {
  const w = mkWorld();
  const g0 = w.gold;
  const t = w.build(0, 'archer');
  assert.ok(t);
  assert.equal(w.gold, g0 - w.buildCost('archer'));
  assert.equal(w.spots[0].tower, t);
  assert.equal(w.build(0, 'mage'), null, 'cannot build on an occupied spot');
  assert.equal(w.stats.towersBuilt, 1);
});

test('build fails without enough gold', () => {
  const w = mkWorld(testLevel([], { startGold: 10 }));
  assert.equal(w.build(0, 'archer'), null);
  assert.equal(w.gold, 10);
});

test('upgrade path: levels 1→3, then a branch to level 4, then skills', () => {
  const w = mkWorld(testLevel([], { startGold: 99999 }));
  const t = w.build(0, 'archer')!;
  assert.equal(w.branchCost(t, 0), null, 'no branch before level 3');
  assert.ok(w.upgrade(t));
  assert.ok(w.upgrade(t));
  assert.equal(t.level, 3);
  assert.equal(w.upgradeCost(t), null, 'level 3 upgrades only through a branch');
  assert.ok(w.chooseBranch(t, 0));
  assert.equal(t.level, 4);
  assert.equal(t.branch, TOWERS.archer.branches[0].branchId);
  const sk = t.def.skills![0];
  assert.ok(w.buySkill(t, sk.id));
  assert.equal(t.skills[sk.id], 1);
  // 技能買滿後不能再買
  while (w.skillCost(t, sk.id) !== null) assert.ok(w.buySkill(t, sk.id));
  assert.equal(w.buySkill(t, sk.id), false);
});

test('sell refunds a fixed share of everything invested', () => {
  const w = mkWorld(testLevel([], { startGold: 99999 }));
  const t = w.build(1, 'barracks')!;
  w.upgrade(t);
  const invested = t.invested;
  const before = w.gold;
  w.sell(t);
  assert.equal(w.gold, before + Math.round(invested * SELL_RATIO));
  assert.equal(w.spots[1].tower, null);
  assert.equal(w.towers.length, 0);
  assert.ok(w.soldiers.every((s) => s.tower !== t || !s.alive), 'barracks soldiers are removed');
});

test('iron rules restrict tower types', () => {
  const w = mkWorld(testLevel([], { rules: { mode: 'iron', allowed: ['archer', 'mage'], noSpells: true } }));
  assert.equal(w.canBuildType('artillery'), false);
  assert.equal(w.build(0, 'artillery'), null);
  assert.ok(w.build(0, 'mage'));
  assert.equal(w.spellsEnabled, false);
});

test('difficulty scales starting gold', () => {
  const lv = testLevel([], { startGold: 1000 });
  assert.ok(mkWorld(lv, { difficulty: 'casual' }).gold > 1000);
  assert.equal(mkWorld(lv, { difficulty: 'normal' }).gold, 1000);
  assert.ok(mkWorld(lv, { difficulty: 'veteran' }).gold < 1000);
});
