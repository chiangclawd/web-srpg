import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HEROES, HERO_ORDER } from '../../src/td/data/heroes';
import { TOWERS } from '../../src/td/data/towers';
import { ICON_KEYS } from '../../src/td/art/ui';
import { ITEMS } from '../../src/td/data/items';
import { VULN_MUL } from '../../src/td/sim/World';
import { mkWorld, run, testLevel } from './helpers';

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

test('Judgment makes enemies take more damage', () => {
  const w = mkWorld(undefined, { hero: { def: HEROES.sharon, xp: 0 } });
  const e = w.spawnEnemy('troll', 0, 640);
  const before = w.damageEnemy(e, 100, 'true', 'tower');
  w.heroUltCd = 0;
  assert.ok(w.castHeroUlt(e.x, e.y));
  const after = w.damageEnemy(e, 100, 'true', 'tower');
  assert.ok(Math.abs(after / before - VULN_MUL) < 1e-9, `${after} vs ${before}`);
  assert.ok(e.slowMul < 1);
});

test('Aegis of Wisdom speeds up nearby towers', () => {
  const play = (haste: boolean) => {
    const w = mkWorld(testLevel([], { startGold: 5000 }));
    const t = w.build(0, 'archer')!;
    run(w, 1);
    if (haste) t.hasteUntil = w.time + 100;
    const e = w.spawnEnemy('troll', 0, 300);
    e.abilityCd = e.abilityCd.map(() => 99);
    const hp0 = e.hp;
    run(w, 4);
    return hp0 - e.hp;
  };
  assert.ok(play(true) > play(false) * 1.15, 'hasted tower deals noticeably more damage');
});

test('Sanctuary heals wounded allies', () => {
  const w = mkWorld(undefined, { hero: { def: HEROES.sharon, xp: 0 } });
  const h = w.hero!;
  h.hp = h.maxHp * 0.3;
  h.hero!.skillCd.sanctuary = 0;
  run(w, 0.2);
  assert.ok(h.hp > h.maxHp * 0.4);
});

test('Viktor skewers a line of enemies and sunders the toughest one', () => {
  // 7 級：三個技能都解鎖
  const w = mkWorld(undefined, { hero: { def: HEROES.viktor, xp: 6000 } });
  const h = w.hero!;
  const troll = w.spawnEnemy('troll', 0, 560);
  const behind = [w.spawnEnemy('raider', 0, 520), w.spawnEnemy('raider', 0, 500)];
  troll.abilityCd = troll.abilityCd.map(() => 99);
  const hp0 = behind.map((e) => e.hp);
  const skills = new Set<string>();
  let sundered = false;
  for (let i = 0; i < 6 * 60 && troll.alive; i++) {
    w.step(1 / 60);
    for (const ev of w.drainEvents()) if (ev.type === 'heroSkill') skills.add(ev.skill);
    if (troll.vulnUntil > w.time) sundered = true;
  }
  assert.ok(skills.has('thrust'), `thrust used (${[...skills].join(',')})`);
  assert.ok(skills.has('sunder'), 'sunder used on the troll');
  assert.ok(sundered, 'the sundered troll takes extra damage');
  assert.ok(behind.some((e, i) => e.hp < hp0[i] || !e.alive), 'the thrust reaches enemies behind the target');
  assert.ok(h.alive);
});

test('Shade blinks behind a caster and executes a badly wounded enemy', () => {
  // 7 級：三個技能都解鎖
  const w = mkWorld(undefined, { hero: { def: HEROES.shadow, xp: 6000 } });
  const h = w.hero!;
  const x0 = h.x;
  const adept = w.spawnEnemy('adept', 0, 520);
  adept.speed = 0;
  const hp0 = adept.hp;
  const skills = new Set<string>();
  for (let i = 0; i < 4 * 60 && !skills.has('shadowstep'); i++) {
    w.step(1 / 60);
    for (const ev of w.drainEvents()) if (ev.type === 'heroSkill') skills.add(ev.skill);
  }
  assert.ok(skills.has('shadowstep'), 'shadow step used on the caster');
  assert.notEqual(Math.round(h.x), Math.round(x0), 'Shade teleported');
  assert.ok(Math.hypot(h.x - adept.x, h.y - adept.y) < 40, 'Shade lands right behind the target');
  assert.ok(adept.hp < hp0 || !adept.alive, 'the backstab hurts');
  if (adept.alive) w.damageEnemy(adept, 9999, 'true', 'spell');
  skills.delete('execute');
  h.hero!.skillCd.execute = 0;
  const lancer = w.spawnEnemy('lancer', 0, adept.d + 10);
  lancer.speed = 0;
  lancer.hp = lancer.maxHp * 0.2;
  for (let i = 0; i < 3 * 60 && lancer.alive; i++) {
    w.step(1 / 60);
    for (const ev of w.drainEvents()) if (ev.type === 'heroSkill') skills.add(ev.skill);
  }
  assert.ok(skills.has('execute'), `execute used (${[...skills].join(',')})`);
  assert.ok(!lancer.alive, 'the wounded lancer is finished off');
});

test('training gives 40% of the current level span and nothing at max level', async () => {
  const { trainXp, HERO_XP_TABLE, HERO_MAX_LEVEL } = await import('../../src/td/data/heroes');
  assert.equal(trainXp(0), 160, 'level 1 → 2 needs 400 XP');
  assert.equal(trainXp(HERO_XP_TABLE[4] + 10), Math.ceil(((HERO_XP_TABLE[5] - HERO_XP_TABLE[4]) * 0.4) / 10) * 10);
  assert.equal(trainXp(HERO_XP_TABLE[HERO_MAX_LEVEL - 1]), 0);
  // 大約 3 次（120 寶石）升一級
  let xp = 0;
  let n = 0;
  while (xp < HERO_XP_TABLE[1]) {
    xp += trainXp(xp);
    n++;
  }
  assert.equal(n, 3);
});
