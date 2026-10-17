import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HAZARD, HAZARD_DROP } from '../../src/td/sim/World';
import { LEVELS } from '../../src/td/data/levels';
import { challengeLevel } from '../../src/td/data/challenges';
import { mkWorld, run, testLevel } from './helpers';

const level = () => testLevel([], { hazards: [{ kind: 'boulder', x: 600, y: 250, path: 0, d0: 900, d1: 300 }] });

test('a boulder rolls along its stretch of road, hits each ground enemy once and goes on cooldown', () => {
  const w = mkWorld(level());
  const foes = [w.spawnEnemy('raider', 0, 400), w.spawnEnemy('lancer', 0, 600), w.spawnEnemy('goblin', 0, 800)];
  const flier = w.spawnEnemy('griffin', 0, 700);
  const outside = w.spawnEnemy('raider', 0, 1100);
  for (const e of w.enemies) e.speed = 0;
  const hp = w.enemies.map((e) => e.hp);
  assert.ok(w.canTriggerHazard(0));
  assert.ok(w.triggerHazard(0));
  assert.equal(w.triggerHazard(0), false, 'cannot push it again while it rolls');
  run(w, HAZARD_DROP * 0.5);
  assert.ok(w.enemies.every((e, i) => e.hp === hp[i]), 'nothing is hit while it is still falling');
  run(w, HAZARD_DROP + 600 / HAZARD.boulder.speed + 0.2);
  assert.equal(w.hazards[0].roll, null, 'the roll has ended');
  assert.ok(!foes[2].alive, 'the goblin is crushed');
  assert.ok(foes[1].alive && foes[1].hp <= foes[1].maxHp - HAZARD.boulder.dmg + 1, 'the lancer takes the full (true) damage once');
  assert.equal(flier.hp, flier.maxHp, 'flying enemies are not hit');
  assert.equal(outside.hp, outside.maxHp, 'enemies off the rolling stretch are not hit');
  assert.ok(w.stats.hazardKills >= 1 && w.stats.bestHazard >= 1);
  assert.ok(w.hazards[0].cd > 0 && !w.canTriggerHazard(0), 'on cooldown afterwards');
  run(w, HAZARD.boulder.cd);
  assert.ok(w.canTriggerHazard(0), 'ready again after the cooldown');
});

test('snowballs slow survivors instead of stunning them', () => {
  const lv = testLevel([], { hazards: [{ kind: 'snowball', x: 600, y: 250, path: 0, d0: 300, d1: 900 }] });
  const w = mkWorld(lv);
  const troll = w.spawnEnemy('troll', 0, 600);
  troll.speed = 0;
  w.triggerHazard(0);
  run(w, HAZARD_DROP + 400 / HAZARD.snowball.speed);
  assert.ok(troll.hp < troll.maxHp);
  assert.ok(troll.slowMul < 1, 'slowed');
  assert.ok(troll.stunUntil <= w.time, 'not stunned');
});

test('level hazards survive challenge / endless variants and sit on real path stretches', () => {
  const withHazards = LEVELS.filter((l) => l.hazards?.length);
  assert.ok(withHazards.length >= 3);
  for (const lv of withHazards) {
    for (const mode of ['heroic', 'iron', 'endless'] as const) assert.deepEqual(challengeLevel(lv, mode).hazards, lv.hazards, `${lv.id} ${mode}`);
    const w = mkWorld(lv);
    lv.hazards!.forEach((h, i) => {
      const len = w.paths[h.path].length;
      assert.ok(h.d0 >= 0 && h.d1 >= 0 && h.d0 <= len && h.d1 <= len, `${lv.id} hazard ${i} roll inside path`);
      assert.ok(Math.abs(h.d1 - h.d0) >= 250, `${lv.id} hazard ${i} rolls a meaningful distance`);
    });
  }
});
