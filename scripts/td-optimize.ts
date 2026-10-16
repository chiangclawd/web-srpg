/**
 * 關卡可破性檢查：以爬山法搜尋「建塔計畫」，回報每關能達到的最佳結果。
 *   npx tsx scripts/td-optimize.ts l7            → 單關（預設 60 次評估）
 *   ITERS=150 npx tsx scripts/td-optimize.ts all → 全部關卡
 *
 * 基因：每個建造點的塔種（或不蓋）、建造順序、各塔種的特化分支、英雄站位。
 * 執行策略：依順序蓋塔 → 有錢就升級最便宜的 → 3 級後特化 → 買技能。
 * 用途：確認「好玩家」能三星，而隨便玩的 AI（td-sim）會吃力 → 難度曲線合理。
 */
import { LEVELS } from '../src/td/data/levels';
import { HEROES } from '../src/td/data/heroes';
import { World, type Difficulty } from '../src/td/sim/World';
import { computeMods } from '../src/td/data/upgrades';
import { Rng } from '../src/td/sim/math';
import type { LevelMode, TowerType } from '../src/td/sim/defs';
import { challengeLevel } from '../src/td/data/challenges';
import { dailyKey, dailyLevel, dailySpec } from '../src/td/data/daily';

const MODE = (process.env.MODE ?? 'campaign') as LevelMode;
/** MODE=daily 時要測哪一天（預設今天） */
const DAILY_KEY = process.env.DAILY_KEY ?? dailyKey();
function modeLevel(id: string) {
  if (MODE === 'daily') return dailyLevel(LEVELS.find((l) => l.id === id)!, DAILY_KEY);
  return challengeLevel(LEVELS.find((l) => l.id === id)!, MODE);
}

const TYPES: (TowerType | null)[] = [null, 'archer', 'barracks', 'mage', 'artillery'];

interface Genome {
  types: (TowerType | null)[];
  order: number[];
  branch: Record<TowerType, number>;
  hero: number;
  heroPath: number;
  /** 最多使用幾個建造點（少而精 vs 多而廣） */
  nTowers: number;
}

function upgradesFor(idx: number): Record<string, number> {
  const stars = Math.floor(idx * 2.5);
  const ups: Record<string, number> = {};
  const cols = ['archer', 'barracks', 'mage', 'artillery', 'meteor', 'reinforce'];
  const costs = [1, 1, 2, 2, 3];
  let left = stars;
  for (let tier = 0; tier < 5 && left > 0; tier++) {
    for (const c of cols) {
      if (left >= costs[tier]) {
        left -= costs[tier];
        ups[c] = tier + 1;
      }
    }
  }
  return ups;
}

export function play(levelId: string, g: Genome, heroId: string, heroXp: number, diff: Difficulty, seed: number) {
  const level = modeLevel(levelId);
  const idx = LEVELS.findIndex((l) => l.id === levelId);
  const w = new World({ level, difficulty: diff, hero: { def: HEROES[heroId], xp: heroXp }, mods: computeMods(upgradesFor(idx)), seed });
  const dt = 1 / 30;
  let think = 0;
  w.callNextWave();
  const hp = w.paths[Math.min(g.heroPath, w.paths.length - 1)];
  const hq = hp.posAt(hp.length * g.hero);
  w.moveHero(hq.x, hq.y);
  const order = g.order.filter((i) => g.types[i]).slice(0, g.nTowers);
  const leaks: Record<string, number> = {};
  const livesByWave: string[] = [];
  let bossHpAtLeak = 0;
  while (!w.result && w.time < 3000) {
    w.step(dt);
    for (const ev of w.drainEvents()) {
      if (ev.type === 'waveStart') livesByWave.push(`${w.lives}/${w.gold}/${w.towers.map((t) => t.level).join('')}`);
      if (ev.type === 'enemyLeak') {
        leaks[ev.e.def.id] = (leaks[ev.e.def.id] ?? 0) + 1;
        if (ev.e.def.boss) bossHpAtLeak = Math.round(ev.e.hp / ev.e.maxHp * 100);
      }
    }
    think -= dt;
    if (think > 0) continue;
    think = 0.5;
    const next = order.find((i) => !w.spots[i].tower);
    const built = w.towers.length;
    // 前期先蓋到一半的計畫塔數，再升級與擴建交替
    const wantBuild = next !== undefined && (built < Math.ceil(order.length * 0.5) || w.towers.every((t) => t.level >= 2));
    if (wantBuild && next !== undefined) {
      const tp = g.types[next]!;
      if (w.gold >= w.buildCost(tp)) w.build(next, tp);
    } else {
      const ups = w.towers.map((t) => ({ t, c: w.upgradeCost(t) })).filter((o) => o.c !== null).sort((a, b) => a.c! - b.c!);
      if (ups.length) {
        if (w.gold >= ups[0].c!) w.upgrade(ups[0].t);
      } else {
        const l3 = w.towers.find((t) => t.level === 3);
        if (l3) {
          const bi = g.branch[l3.type];
          const bc = w.branchCost(l3, bi);
          if (bc !== null && w.gold >= bc) w.chooseBranch(l3, bi);
        } else if (next !== undefined) {
          const tp = g.types[next]!;
          if (w.gold >= w.buildCost(tp)) w.build(next, tp);
        } else {
          for (const t of w.towers) for (const sk of t.def.skills ?? []) {
            const sc = w.skillCost(t, sk.id);
            if (sc !== null && w.gold >= sc) w.buySkill(t, sk.id);
          }
        }
      }
    }
    // 法術：對最接近出口的敵群施放
    const lead = w.enemies.filter((e) => !e.flying).sort((a, b) => a.remaining - b.remaining)[0];
    if (lead && lead.remaining < 700) {
      if (w.meteorCd <= 0) w.castMeteor(lead.x, lead.y);
      if (w.reinfCd <= 0) w.castReinforce(lead.x, lead.y);
    }
    if (w.hero && w.hero.alive && w.hero.hero && !w.hero.hero.moveTo && Math.hypot(w.hero.x - hq.x, w.hero.y - hq.y) > 60 && w.hero.target === null) w.moveHero(hq.x, hq.y);
  }
  const score = w.result === 'victory' ? 1000 + w.lives * 20 : (w.waveIndex + 1) * 40 + w.stats.kills * 0.2;
  return { score, leaks, bossHpAtLeak, livesByWave, result: w.result ?? 'timeout', lives: w.lives, stars: w.stars(), wave: w.waveIndex + 1, waves: w.waveCount, heroXp: w.hero?.hero?.xp ?? 0 };
}

let ALLOWED: (TowerType | null)[] = TYPES;

function randomGenome(n: number, paths: number, rng: Rng): Genome {
  const types = Array.from({ length: n }, () => ALLOWED[1 + Math.floor(rng.next() * (ALLOWED.length - 1))]);
  const order = Array.from({ length: n }, (_, i) => i).sort(() => rng.next() - 0.5);
  return {
    types,
    order,
    branch: { archer: rng.int(0, 1), barracks: rng.int(0, 1), mage: rng.int(0, 1), artillery: rng.int(0, 1) },
    hero: rng.range(0.4, 0.85),
    heroPath: rng.int(0, paths - 1),
    nTowers: rng.int(Math.min(6, n), n),
  };
}

function mutate(g: Genome, paths: number, rng: Rng): Genome {
  const c: Genome = { types: [...g.types], order: [...g.order], branch: { ...g.branch }, hero: g.hero, heroPath: g.heroPath, nTowers: g.nTowers };
  const k = rng.int(0, 6);
  if (k === 6) {
    c.nTowers = Math.max(4, Math.min(c.types.length, c.nTowers + (rng.chance(0.5) ? 1 : -1)));
    return c;
  }
  if (k <= 1) {
    const i = rng.int(0, c.types.length - 1);
    c.types[i] = ALLOWED[rng.int(0, ALLOWED.length - 1)];
  } else if (k <= 3) {
    const i = rng.int(0, c.order.length - 1);
    const j = rng.int(0, c.order.length - 1);
    [c.order[i], c.order[j]] = [c.order[j], c.order[i]];
  } else if (k === 4) {
    const t = (['archer', 'barracks', 'mage', 'artillery'] as TowerType[])[rng.int(0, 3)];
    c.branch[t] = 1 - c.branch[t];
  } else {
    c.hero = Math.min(0.92, Math.max(0.2, c.hero + rng.range(-0.15, 0.15)));
    if (rng.chance(0.3)) c.heroPath = rng.int(0, paths - 1);
  }
  return c;
}

function optimize(levelId: string, iters: number, heroId: string, heroXp: number, diff: Difficulty) {
  const level = modeLevel(levelId);
  const allowed = level.rules?.allowed;
  ALLOWED = allowed ? [null, ...allowed] : TYPES;
  const rng = new Rng(Number(process.env.OPT_SEED ?? 12345));
  const evalG = (g: Genome) => {
    // 兩個亂數種子取平均，避免運氣好的個案
    const a = play(levelId, g, heroId, heroXp, diff, 11);
    const b = play(levelId, g, heroId, heroXp, diff, 29);
    return { score: (a.score + b.score) / 2, a, b };
  };
  let best = randomGenome(level.spots.length, level.paths.length, rng);
  let bestR = evalG(best);
  for (let i = 0; i < 6; i++) {
    const g = randomGenome(level.spots.length, level.paths.length, rng);
    const r = evalG(g);
    if (r.score > bestR.score) {
      best = g;
      bestR = r;
    }
  }
  for (let i = 0; i < iters; i++) {
    let g = mutate(best, level.paths.length, rng);
    if (rng.chance(0.4)) g = mutate(g, level.paths.length, rng);
    const r = evalG(g);
    if (r.score >= bestR.score) {
      best = g;
      bestR = r;
    }
  }
  return { best, r: bestR };
}

const [, , lv, diff] = process.argv;
const ITERS = Number(process.env.ITERS ?? 60);
const levels = MODE === 'daily' ? [dailySpec(DAILY_KEY).levelId] : lv && lv !== 'all' ? [lv] : LEVELS.map((l) => l.id);
const heroId = process.env.HERO ?? 'elena';
for (const id of levels) {
  const idx = LEVELS.findIndex((l) => l.id === id);
  // 假設英雄等級隨關卡推進（約每關 +0.8 級）
  const xpByIdx = [0, 300, 700, 1200, 1900, 2800, 3800, 5000, 6500, 8200, 10000, 12000, 13500, 13500];
  const t0 = Date.now();
  const { best, r } = optimize(id, ITERS, heroId, xpByIdx[idx] ?? 0, (diff as Difficulty) ?? 'normal');
  const plan = best.order.filter((i) => best.types[i]).slice(0, best.nTowers).map((i) => `${i}:${best.types[i]![0]}`).join(' ');
  console.log(
    (process.env.TRACE ? r.a.livesByWave.map((x, i) => `\n   w${i + 1} lives/gold/towers ${x}`).join('') + '\n' : '') +
    `${id} leaks ${JSON.stringify(r.a.leaks)} bossHp@leak ${r.a.bossHpAtLeak}% | best: ${r.a.result}/${r.b.result} lives ${r.a.lives}/${r.b.lives} stars ${r.a.stars}/${r.b.stars} wave ${r.a.wave}/${r.a.waves} (${((Date.now() - t0) / 1000).toFixed(0)}s)  plan ${plan} branch ${JSON.stringify(best.branch)} hero ${best.hero.toFixed(2)}@${best.heroPath}`,
  );
}
