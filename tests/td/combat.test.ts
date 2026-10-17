import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENEMIES } from '../../src/td/data/enemies';
import { mkWorld, run, testLevel } from './helpers';

test('armor reduces physical damage, magic resist reduces magic damage', () => {
  const w = mkWorld();
  const lancer = w.spawnEnemy('lancer', 0, 100);
  const dealt = w.damageEnemy(lancer, 100, 'physical', 'tower');
  assert.equal(Math.round(dealt), Math.round(100 * (1 - ENEMIES.lancer.armor)));
  const adept = w.spawnEnemy('adept', 0, 100);
  const m = w.damageEnemy(adept, 100, 'magic', 'tower');
  assert.equal(Math.round(m), Math.round(100 * (1 - ENEMIES.adept.magicResist)));
  const tru = w.damageEnemy(adept, 10, 'true', 'tower');
  assert.equal(tru, 10, 'true damage ignores resistances');
});

test('killing an enemy pays its bounty and counts the kill', () => {
  const w = mkWorld();
  const g0 = w.gold;
  const e = w.spawnEnemy('goblin', 0, 100);
  w.damageEnemy(e, 9999, 'true', 'tower');
  assert.equal(e.alive, false);
  assert.equal(w.gold, g0 + ENEMIES.goblin.gold);
  assert.equal(w.stats.kills, 1);
  assert.equal(w.stats.goldEarned, ENEMIES.goblin.gold);
});

test('an enemy reaching the exit costs lives', () => {
  const w = mkWorld();
  const e = w.spawnEnemy('raider', 0, 0);
  e.d = e.path.length - 1;
  run(w, 0.5);
  assert.equal(e.leaked, true);
  assert.equal(w.lives, 20 - ENEMIES.raider.lives);
  assert.equal(w.stats.leaks, 1);
});

test('casual difficulty halves a boss leak; endless caps it', () => {
  const casual = mkWorld(testLevel(), { difficulty: 'casual' });
  const b1 = casual.spawnEnemy('morden', 0, 0);
  b1.d = b1.path.length - 1;
  run(casual, 0.5);
  assert.equal(casual.lives, 20 - Math.ceil(ENEMIES.morden.lives / 2));

  const endless = mkWorld(testLevel([], { rules: { mode: 'endless', leakCap: 5 } }));
  const b2 = endless.spawnEnemy('morden', 0, 0);
  b2.d = b2.path.length - 1;
  run(endless, 0.5);
  assert.equal(endless.lives, 15);
});

test('wave HP multiplier is applied and inherited by summons', () => {
  const w = mkWorld();
  const e = w.spawnEnemy('necromancer', 0, 50, 0, 2);
  assert.equal(e.maxHp, ENEMIES.necromancer.hp * 2);
  assert.equal(e.waveMul, 2);
});

test('towers kill a weak wave without leaks', () => {
  const lv = testLevel([{ groups: [{ path: 0, enemy: 'goblin', count: 6, interval: 1 }] }], { startGold: 5000 });
  const w = mkWorld(lv);
  for (let i = 0; i < 4; i++) w.upgrade(w.build(i, i % 2 ? 'mage' : 'archer')!);
  w.callNextWave();
  run(w, 90);
  assert.equal(w.result, 'victory');
  assert.equal(w.lives, 20);
  assert.equal(w.stats.kills, 6);
  assert.equal(w.stars(), 3);
});

test('no defense means defeat', () => {
  const lv = testLevel([{ groups: [{ path: 0, enemy: 'raider', count: 25, interval: 0.5 }] }], { lives: 5 });
  const w = mkWorld(lv);
  w.callNextWave();
  run(w, 120);
  assert.equal(w.result, 'defeat');
  assert.equal(w.stars(), 0);
});

test('calling a wave early pays a bonus', () => {
  const lv = testLevel([
    { groups: [{ path: 0, enemy: 'goblin', count: 1, interval: 1 }], gap: 20 },
    { groups: [{ path: 0, enemy: 'goblin', count: 1, interval: 1 }] },
  ]);
  const w = mkWorld(lv);
  w.callNextWave();
  run(w, 2);
  assert.equal(w.waveState, 'gap');
  const g0 = w.gold;
  const bonus = w.callNextWave();
  assert.ok(bonus > 0);
  assert.equal(w.gold, g0 + bonus);
  assert.equal(w.waveIndex, 1);
});

test('the simulation is deterministic for a given seed', () => {
  const play = () => {
    const lv = testLevel([{ groups: [{ path: 0, enemy: 'wolf', count: 12, interval: 0.4 }, { path: 0, enemy: 'raider', count: 6, interval: 1 }] }], { startGold: 600 });
    const w = mkWorld(lv, { seed: 42 });
    w.build(0, 'archer');
    w.build(1, 'barracks');
    w.callNextWave();
    run(w, 80);
    return [w.result, w.lives, w.gold, w.stats.kills, Math.round(w.time * 60)].join('|');
  };
  assert.equal(play(), play());
});

test('damage and kills are credited to the tower that dealt them (MVP), not to spells', () => {
  const w = mkWorld();
  w.gold = 9999;
  const archer = w.build(0, 'archer')!;
  const barracks = w.build(1, 'barracks')!;
  archer.buildUntil = barracks.buildUntil = 0;
  run(w, 1);
  for (let i = 0; i < 6; i++) w.spawnEnemy('goblin', 0, 200 + i * 30);
  run(w, 25);
  assert.ok(archer.dmgDealt > 0, 'archer arrows are credited');
  assert.ok(barracks.dmgDealt > 0, "barracks soldiers' hits are credited to their tower");
  assert.ok(archer.kills + barracks.kills > 0);
  const before = archer.dmgDealt + barracks.dmgDealt;
  const e = w.spawnEnemy('troll', 0, 900);
  w.damageEnemy(e, 300, 'true', 'spell');
  assert.equal(archer.dmgDealt + barracks.dmgDealt, before, 'direct spell damage is not credited to towers');
  const g = w.spawnEnemy('goblin', 0, 950);
  const dealt = w.damageEnemy(g, 9999, 'true', 'spell');
  assert.ok(dealt > 0 && !g.alive);
});
