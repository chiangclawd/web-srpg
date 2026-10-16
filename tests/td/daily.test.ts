import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAILY_MODS, DAILY_POOL, dailyBaseLevel, dailyKey, dailyLevel, dailySpec } from '../../src/td/data/daily';
import { ENEMIES } from '../../src/td/data/enemies';
import { TOWERS } from '../../src/td/data/towers';
import { gemReward } from '../../src/td/data/items';
import { mkWorld, testLevel } from './helpers';

test('the daily key is the local calendar date', () => {
  assert.equal(dailyKey(new Date(2026, 9, 6, 23, 59)), '2026-10-06');
  assert.equal(dailyKey(new Date(2027, 0, 1, 0, 0)), '2027-01-01');
});

test('daily specs are deterministic, varied and well formed', () => {
  const levels = new Set<string>();
  for (let d = 1; d <= 400; d++) {
    const key = dailyKey(new Date(2026, 10, d));
    const a = dailySpec(key);
    assert.deepEqual(a, dailySpec(key), 'same day, same challenge');
    assert.ok(DAILY_POOL.includes(a.levelId));
    assert.equal(a.mods.length, 2);
    assert.notEqual(a.mods[0], a.mods[1]);
    assert.ok(!(a.mods.includes('poor') && a.mods.includes('rich')), 'no self-cancelling pair');
    assert.ok(!DAILY_MODS[a.mods[0]].good, 'first modifier is always a harsh one');
    assert.equal(a.towers.length, 2);
    if (['l7', 'l8', 'l9', 'l10', 'l13'].includes(a.levelId)) assert.ok(DAILY_MODS[a.mods[1]].good, 'late levels pair the harsh modifier with a helpful one');
    levels.add(a.levelId);
  }
  assert.ok(levels.size >= 6, 'rotates through many levels');
});

test('modifiers change the simulation', () => {
  const lv = testLevel([], {
    rules: { mode: 'daily', enemyHpMul: 1.25, enemySpeedMul: 1.2, enemyArmorAdd: 0.15, bountyMul: 1.3 },
  });
  const w = mkWorld(lv);
  const e = w.spawnEnemy('raider', 0, 100);
  assert.equal(e.maxHp, Math.round(ENEMIES.raider.hp * 1.25));
  assert.equal(e.speed, ENEMIES.raider.speed * 1.2);
  assert.ok(Math.abs(e.armor - (ENEMIES.raider.armor + 0.15)) < 1e-9);
  const g0 = w.gold;
  w.damageEnemy(e, 99999, 'true', 'tower');
  assert.equal(w.gold - g0, Math.round(ENEMIES.raider.gold * 1.3));
  const pricey = mkWorld(testLevel([], { rules: { mode: 'daily', towerCostMul: 1.15 } }));
  assert.equal(pricey.buildCost('archer'), Math.round(TOWERS.archer.levels[0].cost * 1.15));
});

test('a daily level applies its own spec', () => {
  for (let d = 1; d <= 400; d++) {
    const key = dailyKey(new Date(2026, 11, d));
    const spec = dailySpec(key);
    const base = dailyBaseLevel(key);
    const lv = dailyLevel(base, key);
    assert.equal(lv.rules?.mode, 'daily');
    assert.deepEqual(lv.intro, []);
    if (spec.mods.includes('fragile')) assert.equal(lv.lives, 5);
    if (spec.mods.includes('limited')) assert.deepEqual(lv.rules?.allowed, spec.towers);
    if (spec.mods.includes('noSpells')) assert.equal(lv.rules?.noSpells, true);
    if (spec.mods.includes('poor')) assert.ok(lv.startGold < base.startGold);
    if (spec.mods.includes('rich')) assert.ok(lv.startGold > base.startGold);
  }
});

test('daily gems: only the first clear of the day pays', () => {
  assert.equal(gemReward('daily', true, 3, true, 0), 24);
  assert.equal(gemReward('daily', true, 3, false, 0), 0);
  assert.equal(gemReward('daily', false, 0, true, 0), 0);
});
