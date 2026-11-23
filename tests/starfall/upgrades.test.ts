import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Battle } from '../../src/starfall/sim/Battle';
import { BOT_STYLES, autoPlay } from '../../src/starfall/sim/ai';
import { UNITS } from '../../src/starfall/data/units';
import { MISSIONS } from '../../src/starfall/data/missions';
import {
  FRAMES,
  MODS,
  MOD_COST,
  TRACK_COST,
  TRACK_MAX,
  applyUpgrades,
  buyMod,
  buyTrack,
  canAffordAny,
  frameSpent,
  frameUnlocked,
  frameUpgrades,
  loadoutDefs,
  missionOpen,
  missionParts,
  modsOf,
  partsEarned,
  partsLeft,
  partsSpent,
  resetFrame,
} from '../../src/starfall/data/upgrades';
import type { Loadout } from '../../src/starfall/data/upgrades';

const allStars = (n: number): Record<string, number> => Object.fromEntries(MISSIONS.map((m) => [m.id, n]));
/** 每台機體全部改滿 */
const maxed = (): Loadout => Object.fromEntries(FRAMES.map((f) => [f, { plating: TRACK_MAX, firepower: TRACK_MAX, mods: modsOf(f).map((m) => m.id) }]));

test('零件：照拿過的星數發，後面的章節給得多，重複過關不會多拿', () => {
  const m1 = MISSIONS[0];
  assert.equal(missionParts(m1, 0), 0);
  assert.equal(missionParts(m1, 1), 60);
  assert.equal(missionParts(m1, 2), 90);
  assert.equal(missionParts(m1, 3), 120);
  assert.equal(missionParts(m1, 9), 120, 'never more than three stars');
  assert.equal(missionParts({ chapter: 3 }, 3), 240);
  assert.equal(partsEarned({}), 0);
  assert.equal(partsEarned({ m1: 2, m2: 3, nope: 3 }), 90 + 120, 'unknown mission ids are ignored');
  // 主線全部三星拿得到的總量：不夠把六台全部改滿，要取捨
  const total = partsEarned(allStars(3));
  assert.ok(total >= 1500 && total < partsSpent(maxed()), `total ${total} vs max cost ${partsSpent(maxed())}`);
});

test('改造：買得起才買得到，滿級就不能再買，退還是全額', () => {
  const stars = { m1: 3 };
  const lo: Loadout = {};
  assert.equal(partsLeft(stars, lo), 120);
  assert.ok(buyTrack(stars, lo, 'kai', 'plating'));
  assert.equal(partsLeft(stars, lo), 120 - TRACK_COST.plating[0]);
  assert.ok(buyTrack(stars, lo, 'kai', 'firepower'));
  assert.ok(buyTrack(stars, lo, 'kai', 'plating'));
  assert.equal(partsLeft(stars, lo), 0);
  assert.ok(!buyTrack(stars, lo, 'kai', 'firepower'), 'out of parts');
  assert.ok(!buyMod(stars, lo, 'kai', 'kai_link'), 'out of parts');
  assert.ok(!canAffordAny(stars, lo, 'kai'));
  assert.deepEqual(frameUpgrades(lo, 'kai'), { plating: 2, firepower: 1, mods: [] });
  resetFrame(lo, 'kai');
  assert.equal(partsLeft(stars, lo), 120, 'a full refund');
  assert.ok(canAffordAny(stars, lo, 'kai'));

  const rich = allStars(3);
  for (let i = 0; i < TRACK_MAX; i++) assert.ok(buyTrack(rich, lo, 'vey', 'firepower'));
  assert.ok(!buyTrack(rich, lo, 'vey', 'firepower'), 'already at the top level');
  assert.ok(buyMod(rich, lo, 'vey', 'vey_scope'));
  assert.ok(!buyMod(rich, lo, 'vey', 'vey_scope'), 'cannot buy the same mod twice');
  assert.ok(!buyMod(rich, lo, 'vey', 'kai_link'), "another frame's mod");
  assert.ok(!buyMod(rich, lo, 'vey', 'nope'));
  assert.equal(frameSpent(frameUpgrades(lo, 'vey')), TRACK_COST.firepower.reduce((a, b) => a + b, 0) + MOD_COST);
});

test('改造的效果：耐久 +10% / 級、武器 +8% / 級；不會動到原本的定義', () => {
  const before = JSON.stringify(UNITS.kai);
  const d = applyUpgrades(UNITS.kai, { plating: 3, firepower: 2, mods: [] });
  assert.equal(d.hp, 130);
  assert.equal(d.weapon.dmg, Math.round(30 * 1.16));
  assert.equal(JSON.stringify(UNITS.kai), before, 'the base definition is untouched');
  // 沒改造就是原樣
  assert.deepEqual(applyUpgrades(UNITS.bruno, frameUpgrades({}, 'bruno')), UNITS.bruno);
});

test('專屬改造：每台兩個，每一個都真的改到數值，說明文字跟著更新', () => {
  for (const f of FRAMES) assert.equal(modsOf(f).length, 2, f);
  for (const m of MODS) {
    const base = UNITS[m.frame];
    const d = applyUpgrades(base, { plating: 0, firepower: 0, mods: [m.id] });
    assert.notDeepEqual(d, base, `${m.id} changes nothing`);
    assert.ok(m.name.zh && m.name.en && m.desc.zh && m.desc.en, m.id);
    for (const s of d.skills) assert.ok(s.cd >= 1 && s.max >= s.min, `${m.id}: ${s.id}`);
  }
  const kai = applyUpgrades(UNITS.kai, { plating: 0, firepower: 0, mods: ['kai_link', 'kai_burst'] });
  assert.equal(kai.aura?.range, 2);
  assert.deepEqual(kai.skills[0].effect, { type: 'shot', mul: 1.9 });
  assert.match(kai.skills[0].desc.en, /90%/);
  const echo = applyUpgrades(UNITS.echo, { plating: 0, firepower: 0, mods: ['echo_nano', 'echo_relay'] });
  assert.deepEqual(echo.skills[0].effect, { type: 'heal', amount: 60 });
  assert.equal(echo.skills[0].max, 3);
  assert.equal(echo.skills[1].cd, 3);
  assert.match(echo.skills[1].desc.zh, /4 格/);
  const hale = applyUpgrades(UNITS.hale_ally, { plating: 0, firepower: 0, mods: ['hale_phalanx'] });
  assert.equal(hale.aura?.guard, 0.3);
});

test('改造在戰鬥裡生效：集火的預估跟結果都用改造後的數值；敵方同型機不受影響', () => {
  const lo: Loadout = { kai: { plating: 1, firepower: 3, mods: ['kai_burst'] }, hale_ally: { plating: 3, firepower: 3, mods: [] } };
  const defs = loadoutDefs(UNITS, lo);
  const b = new Battle(
    {
      id: 't',
      name: { zh: '', en: '' },
      brief: { zh: '', en: '' },
      tiles: ['......'],
      heights: ['000000'],
      units: [
        { unit: 'kai', side: 'player', x: 0, y: 0 },
        { unit: 'hale', side: 'enemy', x: 2, y: 0, dir: 2, ai: 'hold' },
      ],
      win: { type: 'rout' },
      objective: { zh: '', en: '' },
      par: 5,
    },
    defs,
  );
  b.start();
  const kai = b.units[0];
  const hale = b.units[1];
  assert.equal(kai.maxHp, 110);
  assert.equal(hale.maxHp, 150, 'the enemy Arbiter keeps its own stats');
  const f = b.forecast(kai, hale, kai, kai.def.skills[0]);
  // 步槍 30 × 1.24 = 37，集火 ×1.9，正面打裝甲 5
  assert.equal(f.dmg, Math.round(37 * 1.9) - 5);
  b.useSkill(kai, 'focus', { x: 2, y: 0 });
  assert.equal(hale.hp, 150 - f.dmg);
});

test('存檔裡的改造紀錄壞掉或被亂改：等級夾在範圍內，不認得的改造丟掉', () => {
  const bad = { kai: { plating: 99, firepower: -4, mods: ['kai_link', 'vey_scope', 'zzz', 'kai_link'] }, vey: { plating: 'x', mods: 'y' }, echo: null } as unknown as Loadout;
  assert.deepEqual(frameUpgrades(bad, 'kai'), { plating: 3, firepower: 0, mods: ['kai_link'] });
  assert.deepEqual(frameUpgrades(bad, 'vey'), { plating: 0, firepower: 0, mods: [] });
  assert.deepEqual(frameUpgrades(bad, 'echo'), { plating: 0, firepower: 0, mods: [] });
  assert.deepEqual(frameUpgrades(undefined, 'bruno'), { plating: 0, firepower: 0, mods: [] });
  assert.doesNotThrow(() => loadoutDefs(UNITS, bad));
});

test('機體要加入之後才能改造', () => {
  assert.ok(missionOpen(0, {}));
  assert.ok(!missionOpen(1, {}));
  assert.ok(frameUnlocked('kai', {}));
  assert.ok(!frameUnlocked('sparrow', {}), 'Swift joins in chapter 2');
  assert.ok(!frameUnlocked('hale_ally', allStars(0)));
  const all = allStars(1);
  for (const f of FRAMES) assert.ok(frameUnlocked(f, all), f);
});

test('不管升到幾級，每一關都打得過：兩種機器人打法至少有一種贏', () => {
  const loadouts: [string, Loadout][] = [1, 2, 3].map((lv) => [`level ${lv}`, Object.fromEntries(FRAMES.map((f) => [f, { plating: lv, firepower: lv, mods: [] }]))]);
  loadouts.push(['every upgrade', maxed()]);
  for (const [label, lo] of loadouts) {
    const defs = loadoutDefs(UNITS, lo);
    for (const m of MISSIONS) {
      const results = BOT_STYLES.map((style) => autoPlay(new Battle(m, defs), 40, undefined, style).result);
      assert.ok(results.includes('win'), `${m.id} at ${label}: ${results.join(', ')}`);
    }
  }
});
