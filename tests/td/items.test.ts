import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FROST_SEC, GOLD_SACK, KEG, POTION_LIVES, gemReward } from '../../src/td/data/items';
import { ENEMIES } from '../../src/td/data/enemies';
import { mkWorld, run, testLevel } from './helpers';

test('powder keg damages ground enemies in its radius only', () => {
  const w = mkWorld();
  const near = w.spawnEnemy('troll', 0, 600);
  const far = w.spawnEnemy('troll', 0, 1100);
  const flyer = w.spawnEnemy('griffin', 0, 600);
  assert.ok(w.useItem('keg', near.x, near.y));
  assert.equal(near.hp, ENEMIES.troll.hp - KEG.dmg);
  assert.ok(near.stunUntil > w.time);
  assert.equal(far.hp, ENEMIES.troll.hp);
  assert.equal(flyer.hp, ENEMIES.griffin.hp, 'flyers are not hit');
});

test('frost crystal freezes everyone, bosses for less time', () => {
  const w = mkWorld();
  const a = w.spawnEnemy('raider', 0, 200);
  const b = w.spawnEnemy('morden', 0, 300);
  assert.ok(w.useItem('frost'));
  assert.equal(a.frozenUntil, w.time + FROST_SEC);
  assert.ok(b.frozenUntil - w.time < FROST_SEC);
  const d0 = a.d;
  run(w, 1);
  assert.equal(a.d, d0, 'frozen enemies do not move');
});

test('frost crystal is not wasted on an empty field', () => {
  assert.equal(mkWorld().useItem('frost'), false);
});

test('heart potion restores lives up to the maximum', () => {
  const w = mkWorld();
  assert.equal(w.useItem('potion'), false, 'full lives');
  w.lives = 12;
  assert.ok(w.useItem('potion'));
  assert.equal(w.lives, 12 + POTION_LIVES);
  w.lives = 19;
  assert.ok(w.useItem('potion'));
  assert.equal(w.lives, 20);
});

test('gold sack adds gold; items are disabled where spells are', () => {
  const w = mkWorld();
  const g0 = w.gold;
  assert.ok(w.useItem('gold'));
  assert.equal(w.gold, g0 + GOLD_SACK);
  const iron = mkWorld(testLevel([], { rules: { mode: 'iron', allowed: ['archer', 'mage'], noSpells: true } }));
  assert.equal(iron.useItem('gold'), false);
});

test('gem rewards', () => {
  assert.equal(gemReward('campaign', true, 3, true, 10), 23);
  assert.equal(gemReward('campaign', true, 1, false, 10), 7);
  assert.equal(gemReward('campaign', false, 0, false, 4), 0);
  assert.equal(gemReward('heroic', true, 1, true, 6), 30);
  assert.equal(gemReward('iron', true, 1, false, 1), 8);
  assert.equal(gemReward('endless', false, 0, false, 23), 11);
});
