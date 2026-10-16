import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HEROES, HERO_ORDER } from '../../src/td/data/heroes';
import { TOWERS } from '../../src/td/data/towers';
import { ICON_KEYS } from '../../src/td/art/ui';
import { ITEMS } from '../../src/td/data/items';
import { mkWorld, run } from './helpers';

test('every skill, ultimate and item has an icon texture', () => {
  const keys = new Set(ICON_KEYS);
  for (const id of HERO_ORDER) {
    const h = HEROES[id];
    for (const sk of h.skills) assert.ok(keys.has(`sk_${sk.id}`), `icon sk_${sk.id} for ${id}`);
    assert.ok(keys.has(h.ult.icon), `ult icon for ${id}`);
  }
  for (const t of Object.values(TOWERS)) for (const b of t.branches) for (const sk of b.skills ?? []) assert.ok(keys.has(`sk_${sk.id}`), `tower skill icon sk_${sk.id}`);
  for (const it of Object.values(ITEMS)) assert.ok(keys.has(it.icon), `item icon ${it.icon}`);
});

for (const id of HERO_ORDER) {
  test(`${id}'s ultimate has an effect and a cooldown`, () => {
    const w = mkWorld(undefined, { hero: { def: HEROES[id], xp: 0 } });
    assert.ok(w.heroUltCd > 0, 'starts on a partial cooldown');
    assert.equal(w.castHeroUlt(600, 360), false);
    w.heroUltCd = 0;
    const foes = [w.spawnEnemy('troll', 0, 640), w.spawnEnemy('raider', 0, 660), w.spawnEnemy('griffin', 0, 650)];
    const hp0 = foes.map((e) => e.hp);
    const soldiers0 = w.soldiers.length;
    const x = foes[0].x;
    const y = foes[0].y;
    assert.ok(w.castHeroUlt(x, y));
    assert.equal(w.heroUltCd, HEROES[id].ult.cd);
    assert.equal(w.castHeroUlt(x, y), false, 'cannot recast during cooldown');
    run(w, 2.5);
    const hurt = foes.some((e, i) => e.hp < hp0[i] || !e.alive);
    const summoned = w.soldiers.length > soldiers0;
    assert.ok(hurt || summoned, 'the ultimate damages enemies or summons allies');
  });
}

test('the ultimate is unavailable without a hero', () => {
  const w = mkWorld();
  assert.equal(w.canHeroUlt(), false);
  assert.equal(w.castHeroUlt(100, 100), false);
});
