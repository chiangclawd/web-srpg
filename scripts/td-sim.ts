/**
 * 塔防 headless 平衡模擬：用簡單的 AI 打每一關，確認可以過關、星數合理。
 *   npx tsx scripts/td-sim.ts            → 全部關卡、普通難度
 *   npx tsx scripts/td-sim.ts l3 veteran → 指定關卡與難度
 *
 * AI 策略（刻意「普通玩家」程度，不是最佳解）：
 *   - 依覆蓋度排序建造點，輪流蓋 箭塔 / 兵營 / 法塔 / 砲塔
 *   - 有錢先升級既有塔，3 級後選特化，再點技能
 *   - 波次間隔剩 8 秒時才提前呼叫
 */
import { LEVELS } from '../src/td/data/levels';
import { HEROES } from '../src/td/data/heroes';
import { World, type Difficulty } from '../src/td/sim/World';
import { inEllipse } from '../src/td/sim/math';
import type { TowerType } from '../src/td/sim/defs';
import { computeMods } from '../src/td/data/upgrades';
import { ENEMIES } from '../src/td/data/enemies';

const DEFAULT_PLAN: TowerType[] = ['barracks', 'archer', 'mage', 'archer', 'artillery', 'barracks', 'mage', 'archer', 'artillery', 'mage', 'barracks'];

function run(levelId: string, diff: Difficulty, heroId = 'arthur', heroXp = 0, upgrades: Record<string, number> = {}, verbose = false, seed = 1) {
  const level = LEVELS.find((l) => l.id === levelId)!;
  const world = new World({ level, difficulty: diff, hero: { def: HEROES[heroId], xp: heroXp }, mods: computeMods(upgrades), seed });
  // 建造點依覆蓋度排序
  const order = world.spots
    .map((s, i) => {
      let c = 0;
      for (const p of world.paths) for (const q of p.pts) if (inEllipse(s.x, s.y, q.x, q.y, 160)) c++;
      return { i, c };
    })
    .sort((a, b) => b.c - a.c)
    .map((o) => o.i);
  // 依本關敵人組成調整建塔計畫（模擬玩家看了開場介紹後的反應）
  let airHp = 0;
  let armorHp = 0;
  let totalHp = 0;
  for (const wv of level.waves)
    for (const gr of wv.groups) {
      const e = ENEMIES[gr.enemy];
      const hp = e.hp * gr.count;
      totalHp += hp;
      if (e.flying) airHp += hp;
      if (e.armor >= 0.5) armorHp += hp;
    }
  const PLAN: TowerType[] =
    airHp / totalHp > 0.15
      ? ['barracks', 'archer', 'mage', 'archer', 'mage', 'barracks', 'archer', 'artillery', 'mage', 'archer']
      : armorHp / totalHp > 0.15
        ? ['barracks', 'mage', 'archer', 'artillery', 'mage', 'barracks', 'archer', 'mage', 'artillery']
        : DEFAULT_PLAN;
  let planIdx = 0;
  let heroPlaced = false;
  const leaks: Record<string, number> = {};
  const dt = 1 / 30;
  let thinkT = 0;
  world.callNextWave();
  let maxT = 60 * 40;
  while (!world.result && world.time < maxT) {
    world.step(dt);
    for (const ev of world.drainEvents()) {
      if (ev.type === 'enemyLeak') leaks[ev.e.def.id] = (leaks[ev.e.def.id] ?? 0) + 1;
    }
    thinkT -= dt;
    if (thinkT > 0) continue;
    thinkT = 1;
    // 決策：先蓋到 4 座 → 之後優先升級最便宜的 → 再擴建
    const nextSpot = order.find((i) => !world.spots[i].tower);
    const planType = PLAN[planIdx % PLAN.length];
    if (world.towers.length < 4 && nextSpot !== undefined) {
      if (world.gold >= world.buildCost(planType)) {
        world.build(nextSpot, planType);
        planIdx++;
      }
    } else {
      let acted = false;
      const ups = world.towers
        .map((t) => ({ t, c: world.upgradeCost(t) }))
        .filter((o) => o.c !== null)
        .sort((x, y) => x.c! - y.c!);
      if (ups.length && world.gold >= ups[0].c!) {
        world.upgrade(ups[0].t);
        acted = true;
      }
      if (!acted && !ups.length) {
        for (const t of world.towers) {
          if (t.level === 3) {
            const bi = t.type === 'artillery' ? 1 : 0;
            const bc = world.branchCost(t, bi);
            if (bc !== null && world.gold >= bc) {
              world.chooseBranch(t, bi);
              acted = true;
              break;
            }
          }
        }
      }
      if (!acted && nextSpot !== undefined && world.towers.length < 9 && (ups.length === 0 || world.towers.length < 6)) {
        if (world.gold >= world.buildCost(planType) + 30) {
          world.build(nextSpot, planType);
          planIdx++;
          acted = true;
        }
      }
      if (!acted) {
        for (const t of world.towers) {
          if (t.level !== 4) continue;
          for (const sk of t.def.skills ?? []) {
            const sc = world.skillCost(t, sk.id);
            if (sc !== null && world.gold >= sc) world.buySkill(t, sk.id);
          }
        }
      }
    }
    // 法術
    const target = world.enemies.find((e) => !e.flying && e.remaining < 600);
    if (target && world.meteorCd <= 0) world.castMeteor(target.x, target.y);
    if (target && world.reinfCd <= 0) world.castReinforce(target.x, target.y);
    // 英雄守在最長路徑 65% 處（大多數玩家會把英雄放在塔群附近的咽喉點）
    if (world.hero && world.hero.alive && !heroPlaced) {
      const p = world.paths.reduce((a, b) => (b.length > a.length ? b : a));
      const q = p.posAt(p.length * 0.65);
      world.moveHero(q.x, q.y);
      heroPlaced = true;
    }
    if (process.env.EARLY && world.waveState === 'gap' && world.nextWaveAt - world.time < 8) world.callNextWave();
    if (verbose && Math.floor(world.time) % 30 === 0) {
      console.log(`  t=${world.time.toFixed(0)} wave=${world.waveIndex + 1}/${world.waveCount} gold=${world.gold} lives=${world.lives} enemies=${world.enemies.length} towers=${world.towers.map((t) => t.type[0] + t.level).join(',')}`);
    }
  }
  const hero = world.hero?.hero;
  return {
    level: levelId,
    result: world.result ?? 'timeout',
    lives: world.lives,
    stars: world.stars(),
    time: Math.round(world.time),
    kills: world.stats.kills,
    gold: world.gold,
    heroLv: hero?.level,
    heroXp: Math.round(hero?.xp ?? 0),
    wave: world.waveIndex + 1,
    leaks,
  };
}

const [, , lv, diff] = process.argv;
const diffs: Difficulty[] = diff ? [diff as Difficulty] : ['normal'];
const levels = lv && lv !== 'all' ? [lv] : LEVELS.map((l) => l.id);
const SEEDS = Number(process.env.SEEDS ?? 3);
for (const d of diffs) {
  let xp = 0;
  for (const id of levels) {
    const idx = LEVELS.findIndex((l) => l.id === id);
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
    for (const hero of ['arthur', 'elena']) {
      const rs = [];
      for (let sd = 1; sd <= SEEDS; sd++) rs.push(run(id, d, hero, xp, ups, !!process.env.VERBOSE, sd * 977));
      const wins = rs.filter((r) => r.result === 'victory').length;
      const avgLives = rs.reduce((a, r) => a + r.lives, 0) / rs.length;
      const leaks: Record<string, number> = {};
      for (const r of rs) for (const [k, v] of Object.entries(r.leaks)) leaks[k] = (leaks[k] ?? 0) + v;
      console.log(`${d.padEnd(8)} ${id} ${hero.padEnd(7)} wins ${wins}/${rs.length} avgLives ${avgLives.toFixed(1)} stars ${rs.map((r) => r.stars).join(',')} heroLv ${rs[0].heroLv} leaks ${JSON.stringify(leaks)}`);
      if (hero === 'arthur') xp = Math.max(xp, rs[0].heroXp);
    }
  }
}
