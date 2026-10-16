import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENEMIES } from '../../src/td/data/enemies';
import { mkWorld, run, testLevel } from './helpers';

const burrowDef = () => {
  const a = ENEMIES.scorpion.abilities!.find((x) => x.kind === 'burrow');
  if (!a || a.kind !== 'burrow') throw new Error('scorpion has no burrow');
  return a;
};

test('a scorpion burrows, is immune while underground, then surfaces', () => {
  const w = mkWorld();
  const e = w.spawnEnemy('scorpion', 0, 100);
  e.abilityCd[0] = 0.1;
  run(w, 0.3);
  assert.equal(e.burrowed, true);
  assert.equal(w.damageEnemy(e, 500, 'true', 'tower'), 0, 'no damage while burrowed');
  w.applyStun(e, 5);
  assert.ok(e.stunUntil <= w.time, 'no stun while burrowed');
  run(w, burrowDef().dur + 0.2);
  assert.equal(e.burrowed, false);
  assert.ok(w.damageEnemy(e, 10, 'true', 'tower') > 0);
});

test('burrowed enemies move faster and slip past soldiers', () => {
  const lv = testLevel([], { startGold: 5000 });
  const a = mkWorld(lv);
  const b = mkWorld(lv);
  const ea = a.spawnEnemy('scorpion', 0, 100);
  const eb = b.spawnEnemy('scorpion', 0, 100);
  ea.abilityCd[0] = 999;
  eb.abilityCd[0] = 0.01;
  run(a, 1.5);
  run(b, 1.5);
  assert.ok(eb.d > ea.d + 10, `burrowed one travels further (${eb.d.toFixed(0)} vs ${ea.d.toFixed(0)})`);
});

test('towers do not target burrowed enemies', () => {
  const lv = testLevel([], { startGold: 5000 });
  const w = mkWorld(lv);
  w.build(0, 'archer');
  run(w, 1);
  const e = w.spawnEnemy('scorpion', 0, 340);
  e.burrowed = true;
  e.burrowUntil = w.time + 100;
  e.abilityCd[0] = 999;
  run(w, 2);
  assert.equal(e.hp, e.maxHp, 'an archer in range never hits it');
});
