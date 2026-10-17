import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../../src/td/data/levels';
import { ENEMIES } from '../../src/td/data/enemies';
import { HEROES, HERO_ORDER } from '../../src/td/data/heroes';
import { TOWERS } from '../../src/td/data/towers';
import { challengeLevel, endlessLevel, endlessHpMul, ENDLESS_WAVES } from '../../src/td/data/challenges';
import { STORY, SPEAKERS, STORY_PORTRAITS, EPILOGUE, SIDE_EPILOGUE } from '../../src/td/data/story';
import { ACHIEVEMENTS, evaluateAchievements, type LevelOutcome } from '../../src/td/data/achievements';
import type { SaveData } from '../../src/td/save';
import { BRANCH_BARKS, HERO_BARKS, TOWER_BARKS } from '../../src/td/data/barks';

test('every level wave references a known enemy and a valid path', () => {
  for (const l of LEVELS) {
    assert.ok(l.waves.length > 0, `${l.id} has waves`);
    for (const w of l.waves)
      for (const g of w.groups) {
        assert.ok(ENEMIES[g.enemy], `${l.id}: unknown enemy ${g.enemy}`);
        assert.ok(g.path >= 0 && g.path < l.paths.length, `${l.id}: bad path ${g.path}`);
        assert.ok(g.count > 0 && g.interval > 0, `${l.id}: bad group ${g.enemy}`);
      }
    for (const id of l.intro ?? []) assert.ok(ENEMIES[id], `${l.id}: unknown intro ${id}`);
  }
});

test('level ids, indices and map order are consistent', () => {
  LEVELS.forEach((l, i) => {
    assert.equal(l.index, i);
    assert.equal(l.id, `l${i + 1}`);
  });
});

test('enemy abilities point at existing enemies', () => {
  for (const e of Object.values(ENEMIES))
    for (const a of e.abilities ?? []) if ('enemy' in a) assert.ok(ENEMIES[(a as { enemy: string }).enemy], `${e.id} summons unknown enemy`);
});

test('hero unlocks reference real levels', () => {
  for (const id of HERO_ORDER) {
    const h = HEROES[id];
    assert.ok(h, id);
    if (h.unlockAfter) assert.ok(LEVELS.some((l) => l.id === h.unlockAfter), `${id} unlock level`);
  }
});

test('every tower has 3 levels and 2 branches with skills', () => {
  for (const t of Object.values(TOWERS)) {
    assert.equal(t.levels.length, 3);
    assert.equal(t.branches.length, 2);
    for (const b of t.branches) assert.ok((b.skills ?? []).length > 0, `${b.branchId} has skills`);
  }
});

test('heroic and iron challenges follow their rules', () => {
  for (const l of LEVELS) {
    const h = challengeLevel(l, 'heroic');
    assert.equal(h.lives, 3);
    assert.equal(h.waves.length, 6);
    assert.ok(h.waves.every((w) => w.groups.every((g) => !ENEMIES[g.enemy].boss)), `${l.id} heroic has no boss`);
    const iron = challengeLevel(l, 'iron');
    assert.equal(iron.rules?.noSpells, true);
    assert.equal(iron.rules?.allowed?.length, 2);
  }
  assert.equal(challengeLevel(LEVELS[0], 'campaign'), LEVELS[0]);
});

test('endless waves are deterministic, escalate, and bring a boss every 10 waves', () => {
  for (const l of LEVELS) {
    const a = endlessLevel(l);
    const b = endlessLevel(l);
    assert.deepEqual(a.waves, b.waves, `${l.id} deterministic`);
    assert.equal(a.waves.length, ENDLESS_WAVES);
    assert.equal(a.rules?.leakCap, 5);
    a.waves.forEach((w, i) => {
      const k = i + 1;
      const boss = w.groups.filter((g) => ENEMIES[g.enemy].boss).length;
      assert.equal(boss, k % 10 === 0 ? 1 : 0, `${l.id} wave ${k} boss count`);
      for (const g of w.groups) assert.ok(g.path < l.paths.length);
    });
  }
  for (let k = 1; k < 60; k++) assert.ok(endlessHpMul(k + 1) >= endlessHpMul(k));
  assert.equal(endlessHpMul(1), 1);
});

test('every campaign level has an intro story with known speakers', () => {
  const portraits = new Set([...STORY_PORTRAITS, ...HERO_ORDER]);
  for (const l of LEVELS) assert.ok(STORY[l.id]?.length, `${l.id} story`);
  for (const lines of [...Object.values(STORY), EPILOGUE, SIDE_EPILOGUE])
    for (const ln of lines) {
      assert.ok(SPEAKERS[ln.who], `speaker ${ln.who}`);
      assert.ok(portraits.has(ln.who), `portrait for ${ln.who}`);
      assert.ok(ln.text.zh && ln.text.en);
    }
});

test('achievement ids are unique and endless milestones unlock', () => {
  const ids = ACHIEVEMENTS.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length);
  const sv = { achievements: [], stars: {}, challenges: {}, stats: { kills: 0, plays: 0, victories: 0, towers: 0 } } as unknown as SaveData;
  const o: LevelOutcome = {
    levelId: 'l2', mode: 'endless', difficulty: 'normal', victory: false, stars: 0, lives: 0, maxLives: 20,
    towersAtEnd: 8, maxTowerLevel: 3, skillMaxed: false, earlyCalls: 0, meteorKills: 0, sheep: 0, heroLevel: 3, bossesKilled: ['morden'], wave: 31,
  };
  const fresh = evaluateAchievements(o, sv);
  assert.ok(fresh.includes('endless_15') && fresh.includes('endless_30') && fresh.includes('boss_morden'));
  assert.ok(!fresh.includes('first_win'));
  assert.deepEqual(evaluateAchievements(o, sv), [], 'no duplicates on a second evaluation');
});

test('changelog entries are newest first, uniquely numbered and bilingual', async () => {
  const { CHANGELOG } = await import('../../src/td/data/changelog');
  assert.ok(CHANGELOG.length > 0);
  for (let i = 1; i < CHANGELOG.length; i++) assert.ok(CHANGELOG[i - 1].id > CHANGELOG[i].id, 'ids strictly decrease');
  for (const e of CHANGELOG) {
    assert.ok(e.title.zh && e.title.en);
    assert.ok(e.items.length > 0 && e.items.length <= 8, 'fits in the news panel');
    for (const it of e.items) assert.ok(it.zh && it.en);
  }
});

test('every tower type, specialization and hero has speech-bubble lines', () => {
  const arts = new Set(Object.values(TOWERS).flatMap((t) => [...t.levels, ...t.branches].map((l) => l.art)));
  for (const k of Object.keys(BRANCH_BARKS)) assert.ok(arts.has(k), `bark key ${k} matches a tower art`);
  for (const t of Object.values(TOWERS)) {
    assert.ok(TOWER_BARKS[t.type].length >= 2, t.type);
    for (const b of t.branches) assert.ok(BRANCH_BARKS[b.art]?.length >= 2, b.art);
  }
  for (const id of HERO_ORDER) assert.ok((HERO_BARKS[id] ?? []).length >= 2, id);
  for (const lines of [...Object.values(TOWER_BARKS), ...Object.values(BRANCH_BARKS), ...Object.values(HERO_BARKS)]) {
    for (const l of lines) assert.ok(l.zh.length <= 10 && l.en.length <= 26, `short enough: ${l.zh} / ${l.en}`);
  }
});

test('every level has its painted battlefield registered and on disk', async () => {
  const { PAINTED_LEVELS } = await import('../../src/td/art/terrain');
  const fs = await import('node:fs');
  for (const lv of LEVELS) {
    assert.ok(PAINTED_LEVELS.has(lv.id), `${lv.id} registered in PAINTED_LEVELS`);
    assert.ok(fs.existsSync(`public/assets/levels/${lv.id}.webp`), `${lv.id}.webp exists`);
  }
});
