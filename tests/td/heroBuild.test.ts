import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HEROES, HERO_ORDER, HERO_XP_TABLE } from '../../src/td/data/heroes';
import { HERO_GEAR, RANK_CD, RANK_COST, ULT, autoRanks, pointsToSpend, rankUpBlock, resolveRanks, skillPoints, spentPoints } from '../../src/td/data/heroBuild';
import { heroStats } from '../../src/td/sim/World';
import { ICON_KEYS } from '../../src/td/art/ui';
import { mkWorld } from './helpers';

const arthur = HEROES.arthur;
const xpFor = (lv: number) => HERO_XP_TABLE[lv - 1];

test('10 級有 20 點，全部點滿要 23 點：一定要取捨', () => {
  assert.equal(skillPoints(10), 20);
  const full: Record<string, number> = { [ULT]: 3 };
  for (const sk of arthur.skills) full[sk.id] = 3;
  assert.equal(spentPoints(arthur, full), 23);
});

test('推薦配點：1 級只有第一個技能，技能照原本的解鎖等級出現，10 級三個技能滿階', () => {
  for (const id of HERO_ORDER) {
    const h = HEROES[id];
    const [s1, s2, s3] = h.skills.map((s) => s.id);
    const lv1 = autoRanks(h, 1);
    assert.deepEqual([lv1[s1], lv1[s2] ?? 0, lv1[s3] ?? 0], [1, 0, 0], `${id} level 1`);
    assert.equal(autoRanks(h, 6)[s3] ?? 0, 0, `${id}: third skill waits for level 7`);
    const lv10 = autoRanks(h, 10);
    assert.deepEqual([lv10[s1], lv10[s2], lv10[s3], lv10[ULT]], [3, 3, 3, 2], `${id} level 10`);
    assert.ok(spentPoints(h, lv10) <= skillPoints(10));
  }
});

test('升階要夠等級也要夠點數', () => {
  assert.equal(rankUpBlock(arthur, 2, {}, 'rally'), 'level', 'rally opens at level 4');
  assert.equal(rankUpBlock(arthur, 2, { bash: 1 }, 'bash'), 'level', 'rank 2 needs level 3');
  assert.equal(rankUpBlock(arthur, 3, { bash: 1 }, 'bash'), null);
  assert.equal(rankUpBlock(arthur, 6, { bash: 3, rally: 2, [ULT]: 2 }, 'rally'), 'points', 'level 6 = 12 points, 11 spent, rank 3 costs 3');
  assert.equal(rankUpBlock(arthur, 10, { bash: 3 }, 'bash'), 'max');
  assert.equal(RANK_COST[3], 3);
});

test('存檔裡超出等級的配點會被裁掉；沒寫配點就用推薦配點', () => {
  assert.deepEqual(resolveRanks(arthur, 2, { ranks: { holyblade: 3, bash: 3 } }), { bash: 1 });
  assert.deepEqual(resolveRanks(arthur, 5, {}), autoRanks(arthur, 5));
  assert.equal(pointsToSpend(arthur, 5, {}), 0, 'auto mode never shows a badge');
  assert.equal(pointsToSpend(arthur, 5, { ranks: {} }), 10, 'manual mode with nothing spent');
});

test('沒點的技能不會施放；點了才會', () => {
  const play = (ranks: Record<string, number>) => {
    const w = mkWorld(undefined, { hero: { def: arthur, xp: xpFor(10), build: { ranks } } });
    const h = w.hero!;
    const troll = w.spawnEnemy('troll', 0, 560);
    troll.abilityCd = troll.abilityCd.map(() => 99);
    h.x = troll.x - 30;
    h.y = troll.y;
    const used = new Set<string>();
    for (let i = 0; i < 6 * 60; i++) {
      w.step(1 / 60);
      for (const ev of w.drainEvents()) if (ev.type === 'heroSkill') used.add(ev.skill);
    }
    return used;
  };
  assert.ok(!play({}).has('bash'));
  assert.ok(play({ bash: 1 }).has('bash'));
});

test('絕招升階：傷害 ×1.4、冷卻 ×0.8', () => {
  const blast = (rank: number) => {
    const w = mkWorld(undefined, { hero: { def: HEROES.lila, xp: xpFor(10), build: { ranks: { [ULT]: rank } } } });
    const e = w.spawnEnemy('troll', 0, 640);
    e.abilityCd = e.abilityCd.map(() => 99);
    const hp0 = e.hp;
    w.heroUltCd = 0;
    assert.ok(w.castHeroUlt(e.x, e.y));
    return { dmg: hp0 - e.hp, cd: w.heroUltCdMax };
  };
  const r1 = blast(1);
  const r3 = blast(3);
  assert.ok(Math.abs(r3.dmg / r1.dmg - 1.4) < 0.01, `${r3.dmg} vs ${r1.dmg}`);
  assert.ok(Math.abs(r3.cd - HEROES.lila.ult.cd * RANK_CD[3]) < 1e-9);
});

test('專屬裝備：生命、技能冷卻照描述生效，裝錯英雄沒有效果', () => {
  const lion = HERO_GEAR.arthur.find((g) => g.id === 'lionheart')!;
  assert.equal(heroStats(arthur, 1, lion).hp, Math.round(arthur.hp * 1.15));
  const w = mkWorld(undefined, { hero: { def: arthur, xp: 0, build: { gear: 'lionheart' } } });
  assert.equal(w.hero!.maxHp, Math.round(arthur.hp * 1.15));
  const wrong = mkWorld(undefined, { hero: { def: arthur, xp: 0, build: { gear: 'elvenbow' } } });
  assert.equal(wrong.hero!.maxHp, arthur.hp, 'Elena’s bow does nothing for Arthur');
  // 誓約聖劍：盾擊冷卻 ×0.75
  const w2 = mkWorld(undefined, { hero: { def: arthur, xp: 0, build: { gear: 'oathblade' } } });
  const h = w2.hero!;
  const troll = w2.spawnEnemy('troll', 0, 560);
  troll.abilityCd = troll.abilityCd.map(() => 99);
  h.x = troll.x - 30;
  h.y = troll.y;
  let cd = 0;
  for (let i = 0; i < 4 * 60 && !cd; i++) {
    w2.step(1 / 60);
    for (const ev of w2.drainEvents()) if (ev.type === 'heroSkill' && ev.skill === 'bash') cd = h.hero!.skillCd.bash;
  }
  assert.ok(Math.abs(cd - arthur.skills[0].cd * 0.75) < 0.05, `bash cooldown ${cd}`);
});

test('每位英雄兩件裝備，名稱唯一、圖示存在、改到的技能都屬於自己', () => {
  const keys = new Set(ICON_KEYS);
  const ids = new Set<string>();
  for (const id of HERO_ORDER) {
    const list = HERO_GEAR[id];
    assert.equal(list.length, 2, id);
    const own = new Set([...HEROES[id].skills.map((s) => s.id), ULT]);
    for (const g of list) {
      assert.ok(!ids.has(g.id), `duplicate gear ${g.id}`);
      ids.add(g.id);
      assert.equal(g.hero, id);
      assert.ok(keys.has(g.icon), `icon ${g.icon}`);
      for (const k of [...Object.keys(g.mods.power ?? {}), ...Object.keys(g.mods.cd ?? {})]) assert.ok(own.has(k), `${g.id} touches ${k}, not ${id}'s skill`);
    }
  }
});
