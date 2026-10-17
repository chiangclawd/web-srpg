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

test('night battles shorten tower range by 15%, by level flag or daily rule', async () => {
  const { NIGHT_RANGE } = await import('../../src/td/sim/World');
  const day = mkWorld();
  const night = mkWorld(testLevel([], { night: true }));
  const dailyNight = mkWorld(testLevel([], { rules: { mode: 'daily', night: true } }));
  day.gold = night.gold = dailyNight.gold = 1e6;
  const a = day.build(0, 'archer')!;
  const b = night.build(0, 'archer')!;
  const c = dailyNight.build(0, 'archer')!;
  assert.ok(Math.abs(night.towerRange(b) - day.towerRange(a) * NIGHT_RANGE) < 1e-9);
  assert.ok(Math.abs(dailyNight.towerRange(c) - day.towerRange(a) * NIGHT_RANGE) < 1e-9);
});

test('towers lit by campfires and houses keep full range at night', async () => {
  const { NIGHT_RANGE } = await import('../../src/td/sim/World');
  const lv = testLevel([], { night: true, decor: [{ kind: 'camp', x: 300, y: 200 }] });
  const w = mkWorld(lv);
  w.gold = 1e6;
  const lit = w.build(0, 'archer')!; // (300, 280): next to the campfire
  const dark = w.build(3, 'archer')!; // (900, 440): far away
  const base = lit.def.range;
  assert.equal(w.litAt(lit.x, lit.y), true);
  assert.equal(w.litAt(dark.x, dark.y), false);
  assert.ok(Math.abs(w.towerRange(lit) - base) < 1e-9, 'full range in the light');
  assert.ok(Math.abs(w.towerRange(dark) - base * NIGHT_RANGE) < 1e-9, 'shorter range in the dark');
});

test('wraiths shrug off damage in the dark until a light reveals them', () => {
  const night = mkWorld(testLevel([], { night: true }));
  night.gold = 1e6;
  const hold = (e: { stunUntil: number }) => (e.stunUntil = 1e9);
  const dark = night.spawnEnemy('wraith', 0, 340); // (300, 360): under spot 0, nothing built yet
  hold(dark);
  run(night, 0.1);
  assert.equal(night.damageEnemy(dark, 100, 'true', 'tower'), 50, 'half damage in the dark');
  night.build(0, 'archer');
  run(night, 0.1);
  assert.equal(night.damageEnemy(dark, 100, 'true', 'tower'), 100, 'a tower’s light reveals it');
  const day = mkWorld();
  const e = day.spawnEnemy('wraith', 0, 340);
  hold(e);
  run(day, 0.1);
  assert.equal(day.damageEnemy(e, 100, 'true', 'tower'), 100, 'no shroud in daylight');
});

test('endless mode turns to night for waves 16-20 and back to day at 21', () => {
  const lv = challengeLevel(LEVELS[0], 'endless');
  const nights = lv.waves.slice(0, 40).flatMap((wv, i) => (wv.night ? [i + 1] : []));
  assert.deepEqual(nights, [16, 17, 18, 19, 20, 36, 37, 38, 39, 40]);
  assert.ok(lv.waves[15].groups.some((g) => g.enemy === 'wraith'), 'wraiths come out at night');
  const w = mkWorld(lv);
  w.waveIndex = 14; // wave 15 is on
  assert.equal(w.isNight, false);
  (w as unknown as { startWave(): void }).startWave();
  assert.equal(w.isNight, true);
  w.waveIndex = 18;
  (w as unknown as { startWave(): void }).startWave(); // wave 20: still night
  (w as unknown as { startWave(): void }).startWave(); // wave 21: dawn
  assert.equal(w.isNight, false);
  const flips = w.drainEvents().flatMap((ev) => (ev.type === 'nightfall' ? [ev.on] : []));
  assert.deepEqual(flips, [true, false]);
});
