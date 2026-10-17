import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ELITE } from '../../src/td/sim/World';
import { LEVELS } from '../../src/td/data/levels';
import { challengeLevel } from '../../src/td/data/challenges';
import { mkWorld, run, testLevel } from './helpers';

test('elite affixes strengthen the enemy and double its bounty', () => {
  const w = mkWorld();
  const base = w.spawnEnemy('raider', 0, 100);
  const tough = w.spawnEnemy('raider', 0, 120);
  w.makeElite(tough, 'tough');
  assert.equal(tough.maxHp, Math.round(base.maxHp * ELITE.toughHp));
  assert.ok(tough.armor > base.armor);
  const swift = w.spawnEnemy('raider', 0, 140);
  w.makeElite(swift, 'swift');
  assert.ok(Math.abs(swift.speed - base.speed * ELITE.swiftSpeed) < 1e-9);
  const shielded = w.spawnEnemy('raider', 0, 160);
  w.makeElite(shielded, 'shielded');
  assert.ok(shielded.shield >= shielded.maxHp * ELITE.shield - 1e-9);
  const regen = w.spawnEnemy('raider', 0, 180);
  w.makeElite(regen, 'regen');
  regen.hp = regen.maxHp * 0.5;
  regen.stunUntil = w.time + 10;
  run(w, 1);
  assert.ok(regen.hp > regen.maxHp * 0.5 + regen.maxHp * ELITE.regen * 0.8, 'regenerates about 3% per second');
  const gold0 = w.gold;
  w.damageEnemy(swift, 1e6, 'true', 'tower');
  assert.equal(w.gold - gold0, Math.round(swift.def.gold * ELITE.bounty));
  assert.equal(w.stats.eliteKills, 1);
});

test('campaign waves never roll elites; heroic waves do', () => {
  const lv = LEVELS.find((l) => l.id === 'l6')!;
  const count = (level: typeof lv) => {
    const w = mkWorld(level);
    let elites = 0;
    let spawned = 0;
    w.callNextWave();
    for (let i = 0; i < 60 * 300 && !w.result; i++) {
      if (w.waveState === 'gap') w.callNextWave();
      w.step(1 / 60);
      for (const ev of w.drainEvents()) {
        if (ev.type === 'enemySpawn') spawned++;
        if (ev.type === 'elite') elites++;
      }
      w.lives = 99;
    }
    return { elites, spawned };
  };
  assert.equal(count(lv).elites, 0, 'no elites in the campaign');
  const h = count(challengeLevel(lv, 'heroic'));
  assert.ok(h.elites > 0 && h.elites < h.spawned * 0.4, `heroic has some elites (${h.elites}/${h.spawned})`);
  void testLevel;
});
